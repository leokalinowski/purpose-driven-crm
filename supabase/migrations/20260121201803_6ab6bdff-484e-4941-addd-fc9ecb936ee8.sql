-- Add editor role (must be committed before using it elsewhere)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typnamespace = 'public'::regnamespace
      AND t.typname = 'app_role'
      AND e.enumlabel = 'editor'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'editor';
  END IF;
END $$;