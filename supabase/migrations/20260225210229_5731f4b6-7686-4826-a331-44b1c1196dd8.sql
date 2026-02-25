ALTER TABLE public.newsletter_templates 
  ADD COLUMN IF NOT EXISTS ai_generated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS review_status text DEFAULT null;