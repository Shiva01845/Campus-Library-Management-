-- Library circulation helpers for Supabase.
-- Run this in the Supabase SQL editor if you want the database-side transaction functions.

CREATE OR REPLACE FUNCTION public.issue_book(
  p_copy_id uuid,
  p_user_id uuid,
  p_issued_by uuid,
  p_issue_date date,
  p_due_date date,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_copy RECORD;
  v_book RECORD;
  v_loan_id uuid;
BEGIN
  SELECT * INTO v_copy
  FROM public.book_copies
  WHERE id = p_copy_id
  FOR UPDATE;

  IF v_copy IS NULL THEN
    RAISE EXCEPTION 'Copy not found';
  END IF;

  IF v_copy.status <> 'available' THEN
    RAISE EXCEPTION 'Selected copy is not available';
  END IF;

  SELECT * INTO v_book
  FROM public.books
  WHERE id = v_copy.book_id
  FOR UPDATE;

  IF v_book IS NULL THEN
    RAISE EXCEPTION 'Book not found';
  END IF;

  IF v_book.available_copies < 1 THEN
    RAISE EXCEPTION 'No available copies remain for this title';
  END IF;

  INSERT INTO public.loans (
    copy_id,
    user_id,
    issued_by,
    issue_date,
    due_date,
    status,
    renewal_count,
    notes
  )
  VALUES (
    p_copy_id,
    p_user_id,
    p_issued_by,
    p_issue_date,
    p_due_date,
    'active',
    0,
    p_notes
  )
  RETURNING id INTO v_loan_id;

  UPDATE public.book_copies
  SET status = 'issued'
  WHERE id = p_copy_id;

  UPDATE public.books
  SET available_copies = GREATEST(available_copies - 1, 0)
  WHERE id = v_copy.book_id;

  INSERT INTO public.notifications (
    user_id,
    title,
    message,
    type,
    is_read
  )
  VALUES (
    p_user_id,
    'Book Issued',
    'A new book has been issued to you. Please return it by ' || p_due_date::text || '.',
    'book_issued',
    false
  );

  RETURN v_loan_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.return_book(
  p_loan_id uuid,
  p_returned_to uuid,
  p_return_condition text DEFAULT NULL,
  p_return_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_loan RECORD;
  v_copy RECORD;
  v_book RECORD;
  v_overdue_days integer;
  v_fine_amount numeric;
  v_fine_id uuid;
BEGIN
  SELECT * INTO v_loan
  FROM public.loans
  WHERE id = p_loan_id
  FOR UPDATE;

  IF v_loan IS NULL THEN
    RAISE EXCEPTION 'Loan not found';
  END IF;

  IF v_loan.status = 'returned' THEN
    RAISE EXCEPTION 'Loan is already returned';
  END IF;

  SELECT * INTO v_copy
  FROM public.book_copies
  WHERE id = v_loan.copy_id
  FOR UPDATE;

  SELECT * INTO v_book
  FROM public.books
  WHERE id = v_copy.book_id
  FOR UPDATE;

  UPDATE public.loans
  SET returned_date = now(),
      returned_to = p_returned_to,
      status = 'returned',
      notes = COALESCE(p_return_notes, notes)
  WHERE id = p_loan_id;

  UPDATE public.book_copies
  SET status = 'available',
      condition = COALESCE(p_return_condition, condition)
  WHERE id = v_loan.copy_id;

  UPDATE public.books
  SET available_copies = LEAST(total_copies, available_copies + 1)
  WHERE id = v_copy.book_id;

  v_overdue_days := GREATEST(0, (CURRENT_DATE - v_loan.due_date)::integer);
  v_fine_amount := CASE WHEN v_overdue_days > 0 THEN v_overdue_days * 2.00 ELSE 0.00 END;

  IF v_fine_amount > 0 THEN
    INSERT INTO public.fines (
      loan_id,
      user_id,
      amount,
      reason,
      status,
      issued_at
    )
    VALUES (
      p_loan_id,
      v_loan.user_id,
      v_fine_amount,
      'overdue',
      'pending',
      now()
    )
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.notifications (
    user_id,
    title,
    message,
    type,
    is_read
  )
  VALUES (
    v_loan.user_id,
    'Book Returned',
    'A library item was successfully returned. ' ||
    CASE WHEN v_fine_amount > 0 THEN 'Overdue fine: ₹' || v_fine_amount::text || '.' ELSE 'Thank you.' END,
    'book_returned',
    false
  );

  RETURN p_loan_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.issue_book(uuid, uuid, uuid, date, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.return_book(uuid, uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_college_id text;
  v_department_id uuid;
  v_department_value text;
  v_year_value text;
  v_year integer;
BEGIN
  v_college_id := NULLIF(upper(btrim(NEW.raw_user_meta_data->>'college_id')), '');
  v_department_value := NULLIF(btrim(NEW.raw_user_meta_data->>'department_id'), '');
  IF v_department_value IS NOT NULL THEN
    SELECT id INTO v_department_id
    FROM public.departments
    WHERE lower(id::text) = lower(v_department_value)
       OR lower(btrim(code)) = lower(v_department_value)
       OR lower(btrim(name)) = lower(v_department_value)
    LIMIT 1;
  END IF;
  v_year_value := lower(btrim(NEW.raw_user_meta_data->>'year_of_study'));
  IF v_year_value ~ '^0*[1-6](\.0+)?$' THEN
    v_year := ltrim(split_part(v_year_value, '.', 1), '0')::integer;
  ELSE
    v_year := CASE v_year_value
      WHEN '1st' THEN 1 WHEN '1st year' THEN 1 WHEN 'first year' THEN 1
      WHEN '2nd' THEN 2 WHEN '2nd year' THEN 2 WHEN 'second year' THEN 2
      WHEN '3rd' THEN 3 WHEN '3rd year' THEN 3 WHEN 'third year' THEN 3
      WHEN '4th' THEN 4 WHEN '4th year' THEN 4 WHEN 'fourth year' THEN 4
      WHEN '5th' THEN 5 WHEN '5th year' THEN 5 WHEN 'fifth year' THEN 5
      WHEN '6th' THEN 6 WHEN '6th year' THEN 6 WHEN 'sixth year' THEN 6
      ELSE NULL
    END;
  END IF;

  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    college_id,
    department_id,
    year_of_study,
    role,
    is_active
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), split_part(NEW.email, '@', 1)),
    v_college_id,
    v_department_id,
    v_year,
    'student',
    true
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
