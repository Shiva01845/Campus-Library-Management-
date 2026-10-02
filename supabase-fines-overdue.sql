ALTER TABLE public.fines
  ADD COLUMN IF NOT EXISTS accrual_date date,
  ADD COLUMN IF NOT EXISTS notes text;

WITH ranked_legacy_fines AS (
  SELECT id,
         row_number() OVER (PARTITION BY loan_id, issued_at::date ORDER BY id) AS day_rank
  FROM public.fines
  WHERE reason = 'overdue'
    AND loan_id IS NOT NULL
    AND accrual_date IS NULL
)
UPDATE public.fines AS fine
SET accrual_date = fine.issued_at::date
FROM ranked_legacy_fines AS ranked
WHERE fine.id = ranked.id
  AND ranked.day_rank = 1;

CREATE UNIQUE INDEX IF NOT EXISTS fines_overdue_loan_day_unique
  ON public.fines (loan_id, accrual_date)
  WHERE reason = 'overdue'
    AND loan_id IS NOT NULL
    AND accrual_date IS NOT NULL;

ALTER TABLE public.fines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fines_select_own_or_staff ON public.fines;
CREATE POLICY fines_select_own_or_staff
  ON public.fines
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles AS profile
      WHERE profile.id = auth.uid()
        AND profile.is_active = true
        AND profile.role IN ('librarian', 'admin')
    )
  );

DROP POLICY IF EXISTS fines_manage_staff ON public.fines;
CREATE POLICY fines_manage_staff
  ON public.fines
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles AS profile
      WHERE profile.id = auth.uid()
        AND profile.is_active = true
        AND profile.role IN ('librarian', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles AS profile
      WHERE profile.id = auth.uid()
        AND profile.is_active = true
        AND profile.role IN ('librarian', 'admin')
    )
  );

DROP POLICY IF EXISTS fines_select_scope_guard ON public.fines;
CREATE POLICY fines_select_scope_guard
  ON public.fines
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles AS profile
      WHERE profile.id = auth.uid()
        AND profile.is_active = true
        AND profile.role IN ('librarian', 'admin')
    )
  );

DROP POLICY IF EXISTS fines_insert_staff_guard ON public.fines;
CREATE POLICY fines_insert_staff_guard
  ON public.fines
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles AS profile
      WHERE profile.id = auth.uid()
        AND profile.is_active = true
        AND profile.role IN ('librarian', 'admin')
    )
  );

DROP POLICY IF EXISTS fines_update_staff_guard ON public.fines;
CREATE POLICY fines_update_staff_guard
  ON public.fines
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles AS profile
      WHERE profile.id = auth.uid()
        AND profile.is_active = true
        AND profile.role IN ('librarian', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles AS profile
      WHERE profile.id = auth.uid()
        AND profile.is_active = true
        AND profile.role IN ('librarian', 'admin')
    )
  );

DROP POLICY IF EXISTS fines_delete_staff_guard ON public.fines;
CREATE POLICY fines_delete_staff_guard
  ON public.fines
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles AS profile
      WHERE profile.id = auth.uid()
        AND profile.is_active = true
        AND profile.role IN ('librarian', 'admin')
    )
  );

CREATE TABLE IF NOT EXISTS public.library_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.library_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS library_settings_staff_manage ON public.library_settings;
CREATE POLICY library_settings_staff_manage
  ON public.library_settings
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles AS profile
      WHERE profile.id = auth.uid()
        AND profile.is_active = true
        AND profile.role IN ('librarian', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles AS profile
      WHERE profile.id = auth.uid()
        AND profile.is_active = true
        AND profile.role IN ('librarian', 'admin')
    )
  );

DROP POLICY IF EXISTS library_settings_staff_guard ON public.library_settings;
CREATE POLICY library_settings_staff_guard
  ON public.library_settings
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles AS profile
      WHERE profile.id = auth.uid()
        AND profile.is_active = true
        AND profile.role IN ('librarian', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles AS profile
      WHERE profile.id = auth.uid()
        AND profile.is_active = true
        AND profile.role IN ('librarian', 'admin')
    )
  );

INSERT INTO public.library_settings (key, value)
VALUES ('daily_fine_rate', '5'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.accrue_overdue_fines()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role text;
  v_rate numeric(12, 2);
  v_user_scope uuid;
  v_inserted integer := 0;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Sign in before accruing overdue fines';
  END IF;

  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = v_actor
    AND is_active = true;

  IF COALESCE(v_role, '') IN ('librarian', 'admin') THEN
    v_user_scope := NULL;
  ELSIF COALESCE(v_role, '') IN ('student', 'faculty') THEN
    v_user_scope := v_actor;
  ELSE
    RAISE EXCEPTION 'An active library account is required';
  END IF;

  SELECT NULLIF(trim(both '"' from btrim(value::text)), '')::numeric
  INTO v_rate
  FROM public.library_settings
  WHERE key = 'daily_fine_rate';

  v_rate := COALESCE(v_rate, 5.00);
  IF v_rate <= 0 THEN
    RAISE EXCEPTION 'Daily fine rate must be greater than zero';
  END IF;

  UPDATE public.loans
  SET status = 'overdue'
  WHERE status = 'active'
    AND returned_date IS NULL
    AND due_date < current_date
    AND (v_user_scope IS NULL OR user_id = v_user_scope);

  WITH inserted_fines AS (
    INSERT INTO public.fines (
      loan_id,
      user_id,
      amount,
      reason,
      status,
      issued_at,
      accrual_date,
      notes
    )
    SELECT loan.id,
           loan.user_id,
           v_rate,
           'overdue',
           'pending',
           overdue_day.accrual_day::date::timestamptz,
           overdue_day.accrual_day::date,
           'Overdue fine accrued at ' || v_rate::text || ' per day'
    FROM public.loans AS loan
    CROSS JOIN LATERAL generate_series(
      (loan.due_date::date + 1)::timestamp without time zone,
      current_date::timestamp without time zone,
      interval '1 day'
    ) AS overdue_day(accrual_day)
    WHERE loan.status IN ('active', 'overdue')
      AND loan.returned_date IS NULL
      AND loan.due_date < current_date
      AND (v_user_scope IS NULL OR loan.user_id = v_user_scope)
    ON CONFLICT (loan_id, accrual_date)
      WHERE reason = 'overdue'
        AND loan_id IS NOT NULL
        AND accrual_date IS NOT NULL
    DO NOTHING
    RETURNING user_id, amount, accrual_date
  )
  INSERT INTO public.notifications (user_id,title,message,type,is_read)
  SELECT user_id,
         'Overdue Fine Generated',
         'An overdue fine of ₹' || amount::text || ' was added for ' || accrual_date::text || '.',
         'fine_generated',
         false
  FROM inserted_fines;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.accrue_overdue_fines() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accrue_overdue_fines() TO authenticated;
