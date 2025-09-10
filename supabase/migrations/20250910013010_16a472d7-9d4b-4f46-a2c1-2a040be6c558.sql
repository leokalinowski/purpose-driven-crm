-- Add notes column to event_tasks table for task-specific comments
ALTER TABLE public.event_tasks 
ADD COLUMN notes text;