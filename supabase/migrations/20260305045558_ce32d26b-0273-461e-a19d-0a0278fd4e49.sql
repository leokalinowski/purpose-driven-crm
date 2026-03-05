ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS auto_followup_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS followup_1_days integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS followup_2_days integer NOT NULL DEFAULT 7;