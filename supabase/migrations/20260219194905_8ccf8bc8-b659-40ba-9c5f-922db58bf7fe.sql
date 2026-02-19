
-- Add ClickUp folder and multi-list columns to events
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS clickup_folder_id text,
  ADD COLUMN IF NOT EXISTS clickup_pre_event_list_id text,
  ADD COLUMN IF NOT EXISTS clickup_event_day_list_id text,
  ADD COLUMN IF NOT EXISTS clickup_post_event_list_id text;

-- Add phase column to clickup_tasks
ALTER TABLE public.clickup_tasks
  ADD COLUMN IF NOT EXISTS phase text;
