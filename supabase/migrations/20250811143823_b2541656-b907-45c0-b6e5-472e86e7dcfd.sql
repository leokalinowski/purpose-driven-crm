-- ClickUp integration: add list id to events and synced tasks table
-- 1) Add optional ClickUp list association to events
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS clickup_list_id text;

-- 2) Create synced ClickUp tasks table
CREATE TABLE IF NOT EXISTS public.clickup_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  clickup_task_id text UNIQUE NOT NULL,
  task_name text NOT NULL,
  status text,
  due_date date,
  responsible_person text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.clickup_tasks ENABLE ROW LEVEL SECURITY;

-- RLS: Agents can view tasks for their events or admins can view all
DROP POLICY IF EXISTS "Agents/admins can view clickup tasks" ON public.clickup_tasks;
CREATE POLICY "Agents/admins can view clickup tasks"
ON public.clickup_tasks
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = clickup_tasks.event_id
      AND (e.agent_id = auth.uid() OR get_current_user_role() = 'admin')
  )
);

-- Admins can manage (optional UI in future). Webhooks will use service role, so we restrict app users.
DROP POLICY IF EXISTS "Admins can modify clickup tasks" ON public.clickup_tasks;
CREATE POLICY "Admins can modify clickup tasks"
ON public.clickup_tasks
FOR ALL
TO authenticated
USING (get_current_user_role() = 'admin')
WITH CHECK (get_current_user_role() = 'admin');

-- Trigger to keep updated_at fresh
DROP TRIGGER IF EXISTS trg_clickup_tasks_updated_at ON public.clickup_tasks;
CREATE TRIGGER trg_clickup_tasks_updated_at
BEFORE UPDATE ON public.clickup_tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();