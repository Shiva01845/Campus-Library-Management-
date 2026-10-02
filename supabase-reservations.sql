CREATE INDEX IF NOT EXISTS reservations_book_queue_active_idx
  ON public.reservations (book_id, queue_position, reserved_at)
  WHERE status IN ('pending'::public.reservation_status, 'ready'::public.reservation_status);

WITH ordered AS (
  SELECT id, row_number() OVER (PARTITION BY book_id ORDER BY reserved_at, id)::integer AS position
  FROM public.reservations
  WHERE status IN ('pending'::public.reservation_status, 'ready'::public.reservation_status)
)
UPDATE public.reservations AS reservation
SET queue_position = ordered.position
FROM ordered
WHERE reservation.id = ordered.id
  AND reservation.queue_position IS DISTINCT FROM ordered.position;

CREATE OR REPLACE FUNCTION public.resequence_reservation_queue(p_book_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ordered AS (
    SELECT id, row_number() OVER (ORDER BY reserved_at, id)::integer AS position
    FROM public.reservations
    WHERE book_id = p_book_id
      AND status IN ('pending'::public.reservation_status, 'ready'::public.reservation_status)
  )
  UPDATE public.reservations AS reservation
  SET queue_position = ordered.position
  FROM ordered
  WHERE reservation.id = ordered.id
    AND reservation.queue_position IS DISTINCT FROM ordered.position;
$$;

REVOKE ALL ON FUNCTION public.resequence_reservation_queue(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.create_reservation(p_book_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_role text;
  v_book_title text;
  v_queue_position integer;
  v_reservation_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sign in before creating a reservation';
  END IF;

  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = v_user_id AND is_active = true;

  IF COALESCE(v_role, '') NOT IN ('student', 'faculty') THEN
    RAISE EXCEPTION 'Only active students and faculty can reserve books';
  END IF;

  SELECT title INTO v_book_title
  FROM public.books
  WHERE id = p_book_id AND is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Book not found or inactive';
  END IF;

  PERFORM public.resequence_reservation_queue(p_book_id);

  IF EXISTS (
    SELECT 1
    FROM public.reservations
    WHERE book_id = p_book_id
      AND user_id = v_user_id
      AND status IN ('pending'::public.reservation_status, 'ready'::public.reservation_status)
  ) THEN
    RAISE EXCEPTION 'You already have an active reservation for this book'
      USING ERRCODE = '23505';
  END IF;

  SELECT count(*)::integer + 1 INTO v_queue_position
  FROM public.reservations
  WHERE book_id = p_book_id
    AND status IN ('pending'::public.reservation_status, 'ready'::public.reservation_status);

  INSERT INTO public.reservations (
    book_id,
    user_id,
    reserved_at,
    status,
    queue_position
  )
  VALUES (
    p_book_id,
    v_user_id,
    now(),
    'pending'::public.reservation_status,
    v_queue_position
  )
  RETURNING id INTO v_reservation_id;

  INSERT INTO public.notifications (user_id, title, message, type, is_read)
  VALUES (
    v_user_id,
    'Reservation Created',
    'Your reservation for ' || v_book_title || ' is pending. Queue position: ' || v_queue_position::text || '.',
    'reservation_created',
    false
  );

  RETURN v_reservation_id;
END;
$$;

DROP FUNCTION IF EXISTS public.transition_reservation(uuid, text);

CREATE OR REPLACE FUNCTION public.transition_reservation(
  p_reservation_id uuid,
  p_status public.reservation_status
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role text;
  v_book_id uuid;
  v_reservation public.reservations%ROWTYPE;
  v_book_title text;
  v_available integer;
  v_ready_holds integer;
  v_earlier_pending boolean;
  v_pickup_days integer := 3;
  v_pickup_setting text;
  v_pickup_deadline timestamptz;
BEGIN
  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = v_actor AND is_active = true;

  IF v_actor IS NULL OR COALESCE(v_role, '') NOT IN ('librarian', 'admin') THEN
    RAISE EXCEPTION 'Only an active librarian or admin can update reservations';
  END IF;

  IF p_status IS NULL OR p_status NOT IN (
    'ready'::public.reservation_status,
    'fulfilled'::public.reservation_status,
    'cancelled'::public.reservation_status,
    'expired'::public.reservation_status
  ) THEN
    RAISE EXCEPTION 'Unsupported reservation status';
  END IF;

  SELECT book_id INTO v_book_id
  FROM public.reservations
  WHERE id = p_reservation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation not found';
  END IF;

  PERFORM 1 FROM public.books WHERE id = v_book_id FOR UPDATE;

  SELECT * INTO v_reservation
  FROM public.reservations
  WHERE id = p_reservation_id
  FOR UPDATE;

  SELECT title, available_copies INTO v_book_title, v_available
  FROM public.books
  WHERE id = v_reservation.book_id;

  SELECT trim(both '"' from value::text) INTO v_pickup_setting
  FROM public.library_settings
  WHERE key = 'reservation_pickup_window_days';
  IF COALESCE(v_pickup_setting, '') ~ '^\d+$' THEN
    v_pickup_days := v_pickup_setting::integer;
  END IF;
  IF v_pickup_days < 1 THEN
    RAISE EXCEPTION 'Reservation pickup window must be at least one day';
  END IF;

  IF v_reservation.status = p_status THEN
    RETURN v_reservation.id;
  END IF;

  IF v_reservation.status NOT IN ('pending'::public.reservation_status, 'ready'::public.reservation_status) THEN
    RAISE EXCEPTION 'A terminal reservation cannot be changed';
  END IF;

  IF p_status = 'ready'::public.reservation_status THEN
    IF v_reservation.status <> 'pending'::public.reservation_status THEN
      RAISE EXCEPTION 'Only a pending reservation can be marked ready';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.reservations AS earlier
      WHERE earlier.book_id = v_reservation.book_id
        AND earlier.status = 'pending'::public.reservation_status
        AND earlier.id <> v_reservation.id
        AND (earlier.queue_position, earlier.reserved_at, earlier.id)
            < (v_reservation.queue_position, v_reservation.reserved_at, v_reservation.id)
    ) INTO v_earlier_pending;

    IF v_earlier_pending THEN
      RAISE EXCEPTION 'An earlier reservation must be handled first';
    END IF;

    INSERT INTO public.notifications (user_id, title, message, type, is_read)
    SELECT user_id, 'Reservation Expired', 'Your reservation for ' || v_book_title || ' has expired.', 'reservation_expired', false
    FROM public.reservations
    WHERE book_id = v_reservation.book_id
      AND status = 'ready'::public.reservation_status
      AND expires_at IS NOT NULL
      AND expires_at <= now();

    UPDATE public.reservations
    SET status = 'expired'::public.reservation_status
    WHERE book_id = v_reservation.book_id
      AND status = 'ready'::public.reservation_status
      AND expires_at IS NOT NULL
      AND expires_at <= now();

    SELECT count(*)::integer INTO v_ready_holds
    FROM public.reservations
    WHERE book_id = v_reservation.book_id
      AND status = 'ready'::public.reservation_status
      AND (expires_at IS NULL OR expires_at > now());

    IF COALESCE(v_available, 0) <= v_ready_holds THEN
      RAISE EXCEPTION 'No unreserved physical copy is currently available';
    END IF;
    v_pickup_deadline := now() + make_interval(days => v_pickup_days);
  ELSIF p_status = 'fulfilled'::public.reservation_status THEN
    IF v_reservation.status <> 'ready'::public.reservation_status THEN
      RAISE EXCEPTION 'Only a ready reservation can be fulfilled';
    END IF;
  ELSIF p_status = 'expired'::public.reservation_status THEN
    IF v_reservation.status <> 'ready'::public.reservation_status
       OR v_reservation.expires_at IS NULL
       OR v_reservation.expires_at > now() THEN
      RAISE EXCEPTION 'Only an expired ready reservation can be marked expired';
    END IF;
  END IF;

  UPDATE public.reservations
  SET status = p_status,
      ready_at = CASE WHEN p_status = 'ready'::public.reservation_status THEN now() ELSE ready_at END,
      expires_at = CASE WHEN p_status = 'ready'::public.reservation_status THEN v_pickup_deadline ELSE expires_at END,
      fulfilled_at = CASE WHEN p_status = 'fulfilled'::public.reservation_status THEN now() ELSE fulfilled_at END
  WHERE id = p_reservation_id;

  PERFORM public.resequence_reservation_queue(v_reservation.book_id);

  IF p_status IN (
    'ready'::public.reservation_status,
    'cancelled'::public.reservation_status,
    'expired'::public.reservation_status
  ) THEN
    INSERT INTO public.notifications (user_id, title, message, type, is_read)
    VALUES (
      v_reservation.user_id,
      CASE p_status
        WHEN 'ready'::public.reservation_status THEN 'Reservation Ready'
        WHEN 'cancelled'::public.reservation_status THEN 'Reservation Cancelled'
        ELSE 'Reservation Expired'
      END,
      CASE p_status
        WHEN 'ready'::public.reservation_status THEN 'Your reservation for ' || v_book_title || ' is ready for collection. Please collect it by ' || to_char(v_pickup_deadline, 'YYYY-MM-DD') || '.'
        WHEN 'cancelled'::public.reservation_status THEN 'Your reservation for ' || v_book_title || ' was cancelled.'
        ELSE 'Your reservation for ' || v_book_title || ' has expired.'
      END,
      'reservation_' || p_status::text,
      false
    );
  END IF;

  RETURN p_reservation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.fulfill_ready_reservation_after_loan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_book_id uuid;
  v_reservation_id uuid;
BEGIN
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  SELECT book_id INTO v_book_id
  FROM public.book_copies
  WHERE id = NEW.copy_id;

  IF v_book_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM 1 FROM public.books WHERE id = v_book_id FOR UPDATE;

  SELECT id INTO v_reservation_id
  FROM public.reservations
  WHERE book_id = v_book_id
    AND user_id = NEW.user_id
    AND status = 'ready'::public.reservation_status
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY queue_position NULLS LAST, reserved_at, id
  LIMIT 1
  FOR UPDATE;

  IF v_reservation_id IS NOT NULL THEN
    UPDATE public.reservations
    SET status = 'fulfilled'::public.reservation_status,
      fulfilled_at = now()
    WHERE id = v_reservation_id;
    PERFORM public.resequence_reservation_queue(v_book_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fulfill_ready_reservation_on_loan_insert ON public.loans;
CREATE TRIGGER fulfill_ready_reservation_on_loan_insert
AFTER INSERT ON public.loans
FOR EACH ROW
EXECUTE FUNCTION public.fulfill_ready_reservation_after_loan();

REVOKE ALL ON FUNCTION public.create_reservation(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.transition_reservation(uuid, public.reservation_status) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_reservation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transition_reservation(uuid, public.reservation_status) TO authenticated;
