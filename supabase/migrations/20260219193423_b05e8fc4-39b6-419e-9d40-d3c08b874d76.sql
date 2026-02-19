
-- Add agent_id column to clickup_tasks for direct agent assignment
ALTER TABLE public.clickup_tasks 
ADD COLUMN agent_id uuid REFERENCES public.profiles(user_id);

-- Add index for agent_id lookups
CREATE INDEX idx_clickup_tasks_agent_id ON public.clickup_tasks(agent_id);

-- Update the existing SELECT RLS policy to also allow agents to see tasks assigned directly to them
DROP POLICY IF EXISTS "Agents/admins can view clickup tasks" ON public.clickup_tasks;

CREATE POLICY "Agents/admins can view clickup tasks"
ON public.clickup_tasks
FOR SELECT
USING (
  agent_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = clickup_tasks.event_id
    AND (e.agent_id = auth.uid() OR get_current_user_role() = 'admin')
  )
);
