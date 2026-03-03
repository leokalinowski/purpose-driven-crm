ALTER TABLE public.event_tasks DROP CONSTRAINT event_tasks_status_check;
ALTER TABLE public.event_tasks ADD CONSTRAINT event_tasks_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'overdue'::text]));