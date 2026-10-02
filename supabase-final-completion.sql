-- Run after the existing library schema and the books, reservations, and fines migrations.
CREATE OR REPLACE FUNCTION public.is_library_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS profile
    WHERE profile.id = auth.uid()
      AND profile.is_active = true
      AND profile.role IN ('librarian', 'admin')
  );
$$;

REVOKE ALL ON FUNCTION public.is_library_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_library_staff() TO authenticated;

CREATE OR REPLACE FUNCTION public.update_my_contact(p_phone text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_phone text := NULLIF(btrim(p_phone), '');
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Sign in to update contact information'; END IF;
  IF length(COALESCE(v_phone,'')) > 40 THEN RAISE EXCEPTION 'Phone number is too long'; END IF;
  UPDATE public.profiles SET phone=v_phone WHERE id=v_user_id AND is_active=true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active profile not found'; END IF;
  RETURN v_phone;
END;
$$;

REVOKE ALL ON FUNCTION public.update_my_contact(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_my_contact(text) TO authenticated;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_copies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.authors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_authors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_own_or_staff ON public.profiles;
CREATE POLICY profiles_select_own_or_staff
  ON public.profiles
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (id=auth.uid() OR public.is_library_staff());

DROP POLICY IF EXISTS profiles_staff_manage ON public.profiles;
CREATE POLICY profiles_staff_manage
  ON public.profiles
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.is_library_staff())
  WITH CHECK (public.is_library_staff());

DROP POLICY IF EXISTS profiles_select_scope_guard ON public.profiles;
CREATE POLICY profiles_select_scope_guard
  ON public.profiles
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (id=auth.uid() OR public.is_library_staff());

DROP POLICY IF EXISTS profiles_insert_staff_guard ON public.profiles;
CREATE POLICY profiles_insert_staff_guard
  ON public.profiles
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_library_staff());

DROP POLICY IF EXISTS profiles_update_staff_guard ON public.profiles;
CREATE POLICY profiles_update_staff_guard
  ON public.profiles
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_library_staff())
  WITH CHECK (public.is_library_staff());

DROP POLICY IF EXISTS profiles_delete_staff_guard ON public.profiles;
CREATE POLICY profiles_delete_staff_guard
  ON public.profiles
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_library_staff());

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.library_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  resource_type text NOT NULL DEFAULT 'link',
  url text NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true
);

ALTER TABLE public.library_resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS library_resources_select_active ON public.library_resources;
CREATE POLICY library_resources_select_active
  ON public.library_resources
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_active OR public.is_library_staff());

DROP POLICY IF EXISTS library_resources_staff_manage ON public.library_resources;
CREATE POLICY library_resources_staff_manage
  ON public.library_resources
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.is_library_staff())
  WITH CHECK (public.is_library_staff());

DROP POLICY IF EXISTS library_resources_select_guard ON public.library_resources;
CREATE POLICY library_resources_select_guard
  ON public.library_resources
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (is_active OR public.is_library_staff());

DROP POLICY IF EXISTS library_resources_insert_guard ON public.library_resources;
CREATE POLICY library_resources_insert_guard
  ON public.library_resources
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_library_staff());

DROP POLICY IF EXISTS library_resources_update_guard ON public.library_resources;
CREATE POLICY library_resources_update_guard
  ON public.library_resources
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_library_staff())
  WITH CHECK (public.is_library_staff());

DROP POLICY IF EXISTS library_resources_delete_guard ON public.library_resources;
CREATE POLICY library_resources_delete_guard
  ON public.library_resources
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_library_staff());

DROP POLICY IF EXISTS categories_select_authenticated ON public.categories;
CREATE POLICY categories_select_authenticated
  ON public.categories
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS categories_staff_manage ON public.categories;
CREATE POLICY categories_staff_manage
  ON public.categories
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.is_library_staff())
  WITH CHECK (public.is_library_staff());

DROP POLICY IF EXISTS categories_insert_guard ON public.categories;
CREATE POLICY categories_insert_guard
  ON public.categories
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_library_staff());

DROP POLICY IF EXISTS categories_update_guard ON public.categories;
CREATE POLICY categories_update_guard
  ON public.categories
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_library_staff())
  WITH CHECK (public.is_library_staff());

DROP POLICY IF EXISTS categories_delete_guard ON public.categories;
CREATE POLICY categories_delete_guard
  ON public.categories
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_library_staff());

DROP POLICY IF EXISTS authors_select_authenticated ON public.authors;
CREATE POLICY authors_select_authenticated
  ON public.authors
  AS PERMISSIVE FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS authors_staff_manage ON public.authors;
CREATE POLICY authors_staff_manage
  ON public.authors
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.is_library_staff()) WITH CHECK (public.is_library_staff());
DROP POLICY IF EXISTS authors_insert_guard ON public.authors;
CREATE POLICY authors_insert_guard
  ON public.authors
  AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.is_library_staff());
DROP POLICY IF EXISTS authors_update_guard ON public.authors;
CREATE POLICY authors_update_guard
  ON public.authors
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_library_staff()) WITH CHECK (public.is_library_staff());
DROP POLICY IF EXISTS authors_delete_guard ON public.authors;
CREATE POLICY authors_delete_guard
  ON public.authors
  AS RESTRICTIVE FOR DELETE TO authenticated USING (public.is_library_staff());

DROP POLICY IF EXISTS book_authors_select_authenticated ON public.book_authors;
CREATE POLICY book_authors_select_authenticated
  ON public.book_authors
  AS PERMISSIVE FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS book_authors_staff_manage ON public.book_authors;
CREATE POLICY book_authors_staff_manage
  ON public.book_authors
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.is_library_staff()) WITH CHECK (public.is_library_staff());
DROP POLICY IF EXISTS book_authors_insert_guard ON public.book_authors;
CREATE POLICY book_authors_insert_guard
  ON public.book_authors
  AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.is_library_staff());
DROP POLICY IF EXISTS book_authors_update_guard ON public.book_authors;
CREATE POLICY book_authors_update_guard
  ON public.book_authors
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_library_staff()) WITH CHECK (public.is_library_staff());
DROP POLICY IF EXISTS book_authors_delete_guard ON public.book_authors;
CREATE POLICY book_authors_delete_guard
  ON public.book_authors
  AS RESTRICTIVE FOR DELETE TO authenticated USING (public.is_library_staff());

DROP POLICY IF EXISTS loans_select_own_or_staff ON public.loans;
CREATE POLICY loans_select_own_or_staff
  ON public.loans
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_library_staff());

DROP POLICY IF EXISTS loans_staff_manage ON public.loans;
CREATE POLICY loans_staff_manage
  ON public.loans
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.is_library_staff())
  WITH CHECK (public.is_library_staff());

DROP POLICY IF EXISTS loans_select_scope_guard ON public.loans;
CREATE POLICY loans_select_scope_guard
  ON public.loans
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_library_staff());

DROP POLICY IF EXISTS loans_insert_staff_guard ON public.loans;
CREATE POLICY loans_insert_staff_guard
  ON public.loans
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_library_staff());

DROP POLICY IF EXISTS loans_update_staff_guard ON public.loans;
CREATE POLICY loans_update_staff_guard
  ON public.loans
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_library_staff())
  WITH CHECK (public.is_library_staff());

DROP POLICY IF EXISTS loans_delete_staff_guard ON public.loans;
CREATE POLICY loans_delete_staff_guard
  ON public.loans
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_library_staff());

DROP POLICY IF EXISTS books_select_authenticated ON public.books;
CREATE POLICY books_select_authenticated
  ON public.books
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS books_staff_manage ON public.books;
CREATE POLICY books_staff_manage
  ON public.books
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.is_library_staff())
  WITH CHECK (public.is_library_staff());

DROP POLICY IF EXISTS books_insert_staff_guard ON public.books;
CREATE POLICY books_insert_staff_guard
  ON public.books
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_library_staff());

DROP POLICY IF EXISTS books_update_staff_guard ON public.books;
CREATE POLICY books_update_staff_guard
  ON public.books
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_library_staff())
  WITH CHECK (public.is_library_staff());

DROP POLICY IF EXISTS books_delete_staff_guard ON public.books;
CREATE POLICY books_delete_staff_guard
  ON public.books
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_library_staff());

DROP POLICY IF EXISTS book_copies_select_authenticated ON public.book_copies;
CREATE POLICY book_copies_select_authenticated
  ON public.book_copies
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS book_copies_staff_manage ON public.book_copies;
CREATE POLICY book_copies_staff_manage
  ON public.book_copies
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.is_library_staff())
  WITH CHECK (public.is_library_staff());

DROP POLICY IF EXISTS book_copies_insert_staff_guard ON public.book_copies;
CREATE POLICY book_copies_insert_staff_guard
  ON public.book_copies
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_library_staff());

DROP POLICY IF EXISTS book_copies_update_staff_guard ON public.book_copies;
CREATE POLICY book_copies_update_staff_guard
  ON public.book_copies
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_library_staff())
  WITH CHECK (public.is_library_staff());

DROP POLICY IF EXISTS book_copies_delete_staff_guard ON public.book_copies;
CREATE POLICY book_copies_delete_staff_guard
  ON public.book_copies
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_library_staff());

DROP POLICY IF EXISTS reservations_select_own_or_staff ON public.reservations;
CREATE POLICY reservations_select_own_or_staff
  ON public.reservations
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_library_staff());

DROP POLICY IF EXISTS reservations_staff_manage ON public.reservations;
CREATE POLICY reservations_staff_manage
  ON public.reservations
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.is_library_staff())
  WITH CHECK (public.is_library_staff());

DROP POLICY IF EXISTS reservations_select_scope_guard ON public.reservations;
CREATE POLICY reservations_select_scope_guard
  ON public.reservations
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_library_staff());

DROP POLICY IF EXISTS reservations_insert_rpc_guard ON public.reservations;
CREATE POLICY reservations_insert_rpc_guard
  ON public.reservations
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_library_staff());

DROP POLICY IF EXISTS reservations_update_staff_guard ON public.reservations;
CREATE POLICY reservations_update_staff_guard
  ON public.reservations
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_library_staff())
  WITH CHECK (public.is_library_staff());

DROP POLICY IF EXISTS reservations_delete_staff_guard ON public.reservations;
CREATE POLICY reservations_delete_staff_guard
  ON public.reservations
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_library_staff());

DROP POLICY IF EXISTS notifications_select_own_or_staff ON public.notifications;
CREATE POLICY notifications_select_own_or_staff
  ON public.notifications
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_library_staff());

DROP POLICY IF EXISTS notifications_update_own_or_staff ON public.notifications;
CREATE POLICY notifications_update_own_or_staff
  ON public.notifications
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_library_staff())
  WITH CHECK (user_id = auth.uid() OR public.is_library_staff());

DROP POLICY IF EXISTS notifications_insert_staff ON public.notifications;
CREATE POLICY notifications_insert_staff
  ON public.notifications
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_library_staff());

DROP POLICY IF EXISTS notifications_select_scope_guard ON public.notifications;
CREATE POLICY notifications_select_scope_guard
  ON public.notifications
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_library_staff());

DROP POLICY IF EXISTS notifications_update_scope_guard ON public.notifications;
CREATE POLICY notifications_update_scope_guard
  ON public.notifications
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_library_staff())
  WITH CHECK (user_id = auth.uid() OR public.is_library_staff());

DROP POLICY IF EXISTS notifications_insert_staff_guard ON public.notifications;
CREATE POLICY notifications_insert_staff_guard
  ON public.notifications
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_library_staff());

DROP POLICY IF EXISTS notifications_delete_staff_guard ON public.notifications;
CREATE POLICY notifications_delete_staff_guard
  ON public.notifications
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_library_staff());

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS dedupe_key text;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_user_dedupe_key_unique
  ON public.notifications (user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_loan_due_notifications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_user_scope uuid;
  v_inserted integer := 0;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Sign in to refresh due notifications'; END IF;
  IF public.is_library_staff() THEN
    v_user_scope := NULL;
  ELSE
    v_user_scope := v_actor;
  END IF;

  INSERT INTO public.notifications(user_id,title,message,type,is_read,dedupe_key)
  SELECT loan.user_id,
         'Book Due Soon',
         'Your borrowed book is due on ' || loan.due_date::text || '.',
         'due_soon',
         false,
         'due-soon:' || loan.id::text || ':' || loan.due_date::text
  FROM public.loans AS loan
  WHERE loan.returned_date IS NULL
    AND loan.status IN ('active','overdue')
    AND loan.due_date BETWEEN current_date AND current_date + 3
    AND (v_user_scope IS NULL OR loan.user_id=v_user_scope)
  ON CONFLICT (user_id,dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

  GET DIAGNOSTICS v_inserted=ROW_COUNT;

  INSERT INTO public.notifications(user_id,title,message,type,is_read,dedupe_key)
  SELECT loan.user_id,
         'Book Overdue',
         'Your borrowed book was due on ' || loan.due_date::text || ' and has not been returned.',
         'overdue',
         false,
         'overdue:' || loan.id::text || ':' || current_date::text
  FROM public.loans AS loan
  WHERE loan.returned_date IS NULL
    AND loan.status IN ('active','overdue')
    AND loan.due_date < current_date
    AND (v_user_scope IS NULL OR loan.user_id=v_user_scope)
  ON CONFLICT (user_id,dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

  GET DIAGNOSTICS v_inserted=ROW_COUNT;
  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_loan_due_notifications() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_loan_due_notifications() TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_own_reservation(p_reservation_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_reservation public.reservations%ROWTYPE;
  v_title text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sign in before cancelling a reservation';
  END IF;

  SELECT * INTO v_reservation
  FROM public.reservations
  WHERE id = p_reservation_id AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation not found';
  END IF;
  IF v_reservation.status <> 'pending'::public.reservation_status THEN
    RAISE EXCEPTION 'Only your pending reservations can be cancelled';
  END IF;

  SELECT title INTO v_title FROM public.books WHERE id = v_reservation.book_id;
  UPDATE public.reservations
  SET status = 'cancelled'::public.reservation_status
  WHERE id = p_reservation_id;
  PERFORM public.resequence_reservation_queue(v_reservation.book_id);

  INSERT INTO public.notifications (user_id, title, message, type, is_read)
  VALUES (v_user_id, 'Reservation Cancelled', 'Your reservation for ' || COALESCE(v_title, 'a library book') || ' was cancelled.', 'reservation_cancelled', false);
  RETURN p_reservation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_own_reservation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_own_reservation(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.renew_loan(p_loan_id uuid)
RETURNS date
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_role text;
  v_loan public.loans%ROWTYPE;
  v_default_days integer := 14;
  v_max_renewals integer := 1;
  v_book_id uuid;
  v_new_due_date date;
  v_setting text;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Sign in before renewing a loan'; END IF;

  SELECT role INTO v_role FROM public.profiles
  WHERE id = v_user_id AND is_active = true;
  IF COALESCE(v_role, '') NOT IN ('student', 'faculty') THEN
    RAISE EXCEPTION 'Only active students and faculty can renew loans';
  END IF;

  SELECT * INTO v_loan FROM public.loans
  WHERE id = p_loan_id AND user_id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Loan not found'; END IF;
  IF v_loan.status <> 'active' OR v_loan.returned_date IS NOT NULL OR v_loan.due_date < current_date THEN
    RAISE EXCEPTION 'Only current, non-overdue loans can be renewed';
  END IF;

  SELECT book_id INTO v_book_id FROM public.book_copies WHERE id = v_loan.copy_id;
  IF EXISTS (
    SELECT 1 FROM public.reservations
    WHERE book_id = v_book_id
      AND status IN ('pending'::public.reservation_status, 'ready'::public.reservation_status)
  ) THEN
    RAISE EXCEPTION 'This book has an active reservation and cannot be renewed';
  END IF;

  SELECT trim(both '"' from value::text) INTO v_setting
  FROM public.library_settings WHERE key='default_loan_duration_days';
  IF COALESCE(v_setting,'') ~ '^\d+$' THEN v_default_days := v_setting::integer; END IF;
  SELECT trim(both '"' from value::text) INTO v_setting
  FROM public.library_settings WHERE key='maximum_renewal_count';
  IF COALESCE(v_setting,'') ~ '^\d+$' THEN v_max_renewals := v_setting::integer; END IF;
  IF v_default_days < 1 OR v_max_renewals < 0 THEN RAISE EXCEPTION 'Loan settings are invalid'; END IF;
  IF COALESCE(v_loan.renewal_count,0) >= v_max_renewals THEN RAISE EXCEPTION 'Maximum renewals reached'; END IF;

  v_new_due_date := v_loan.due_date + v_default_days;
  UPDATE public.loans
  SET due_date = v_new_due_date, renewal_count = COALESCE(renewal_count,0) + 1
  WHERE id = p_loan_id;
  INSERT INTO public.notifications (user_id,title,message,type,is_read)
  VALUES (v_user_id,'Loan Renewed','Your loan has been renewed until ' || v_new_due_date::text || '.','loan_renewed',false);
  RETURN v_new_due_date;
END;
$$;

REVOKE ALL ON FUNCTION public.renew_loan(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.renew_loan(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.send_library_announcement(
  p_title text,
  p_message text,
  p_target_role text DEFAULT 'all'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF NOT public.is_library_staff() THEN RAISE EXCEPTION 'Only librarians/admins can send announcements'; END IF;
  IF NULLIF(btrim(p_title),'') IS NULL OR NULLIF(btrim(p_message),'') IS NULL THEN RAISE EXCEPTION 'Title and message are required'; END IF;
  IF p_target_role IS NULL OR p_target_role NOT IN ('all','student','faculty') THEN RAISE EXCEPTION 'Invalid announcement audience'; END IF;

  INSERT INTO public.notifications (user_id,title,message,type,is_read)
  SELECT profile.id,btrim(p_title),btrim(p_message),'announcement',false
  FROM public.profiles AS profile
  WHERE profile.is_active=true
    AND profile.role IN ('student','faculty')
    AND (p_target_role='all' OR profile.role::text=p_target_role);
  GET DIAGNOSTICS v_count=ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.send_library_announcement(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_library_announcement(text,text,text) TO authenticated;

INSERT INTO public.library_settings(key,value) VALUES
  ('default_loan_duration_days','14'::jsonb),
  ('maximum_renewal_count','1'::jsonb),
  ('reservation_pickup_window_days','3'::jsonb)
ON CONFLICT (key) DO NOTHING;