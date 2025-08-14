-- Add week_number and year columns to coaching_submissions
ALTER TABLE public.coaching_submissions 
ADD COLUMN week_number integer,
ADD COLUMN year integer;

-- Populate the new columns from existing week_ending data
UPDATE public.coaching_submissions 
SET 
  week_number = EXTRACT(week FROM week_ending),
  year = EXTRACT(year FROM week_ending)
WHERE week_number IS NULL;

-- Make the new columns not null after populating
ALTER TABLE public.coaching_submissions 
ALTER COLUMN week_number SET NOT NULL,
ALTER COLUMN year SET NOT NULL;

-- Add an index for better performance
CREATE INDEX idx_coaching_submissions_week_year ON public.coaching_submissions(agent_id, year, week_number);