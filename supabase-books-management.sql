ALTER TABLE public.book_copies
  ADD COLUMN IF NOT EXISTS accession_code text,
  ADD COLUMN IF NOT EXISTS price numeric(12, 2),
  ADD COLUMN IF NOT EXISTS acquired_date date,
  ADD COLUMN IF NOT EXISTS notes text;

UPDATE public.book_copies
SET accession_code = copy_number
WHERE NULLIF(btrim(accession_code), '') IS NULL
  AND NULLIF(btrim(copy_number), '') IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS book_copies_accession_code_unique
  ON public.book_copies (lower(btrim(accession_code)))
  WHERE NULLIF(btrim(accession_code), '') IS NOT NULL;