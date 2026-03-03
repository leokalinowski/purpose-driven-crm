-- Add phase column to event_tasks table for tier-based task management
ALTER TABLE public.event_tasks 
ADD COLUMN phase text;

-- Add a check constraint to ensure valid phase values
ALTER TABLE public.event_tasks
ADD CONSTRAINT event_tasks_phase_check 
CHECK (phase IS NULL OR phase IN ('pre_event', 'event_day', 'post_event'));