-- Add new columns for coaching submissions
ALTER TABLE public.coaching_submissions 
ADD COLUMN IF NOT EXISTS appointments_held INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS closing_amount NUMERIC(12,2) DEFAULT 0;

-- Add comments for documentation
COMMENT ON COLUMN public.coaching_submissions.appointments_held IS 'Number of appointments that were actually held';
COMMENT ON COLUMN public.coaching_submissions.closing_amount IS 'Total dollar amount of closings ($)';