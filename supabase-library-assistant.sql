-- Per-user request throttling for the authenticated library-assistant Edge Function.
CREATE TABLE IF NOT EXISTS public.library_assistant_rate_limits (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 0
);

ALTER TABLE public.library_assistant_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.library_assistant_rate_limits FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.consume_library_assistant_request()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
  v_request_count integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required';
  END IF;

  INSERT INTO public.library_assistant_rate_limits (user_id, window_started_at, request_count)
  VALUES (v_user_id, v_now, 1)
  ON CONFLICT (user_id) DO UPDATE
  SET window_started_at = CASE
        WHEN public.library_assistant_rate_limits.window_started_at <= v_now - interval '1 minute'
          THEN v_now
        ELSE public.library_assistant_rate_limits.window_started_at
      END,
      request_count = CASE
        WHEN public.library_assistant_rate_limits.window_started_at <= v_now - interval '1 minute'
          THEN 1
        ELSE public.library_assistant_rate_limits.request_count + 1
      END
  RETURNING request_count INTO v_request_count;

  RETURN v_request_count <= 10;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_library_assistant_request() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_library_assistant_request() TO authenticated;
