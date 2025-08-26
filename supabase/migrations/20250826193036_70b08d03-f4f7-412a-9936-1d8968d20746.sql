-- Enable RLS on spheresync_tasks table
ALTER TABLE public.spheresync_tasks ENABLE ROW LEVEL SECURITY;

-- Create policies for spheresync_tasks
CREATE POLICY "Users can view their own spheresync tasks" 
ON public.spheresync_tasks 
FOR SELECT 
USING (agent_id = auth.uid() OR get_current_user_role() = 'admin');

CREATE POLICY "Users can insert their own spheresync tasks" 
ON public.spheresync_tasks 
FOR INSERT 
WITH CHECK (agent_id = auth.uid() OR get_current_user_role() = 'admin');

CREATE POLICY "Users can update their own spheresync tasks" 
ON public.spheresync_tasks 
FOR UPDATE 
USING (agent_id = auth.uid() OR get_current_user_role() = 'admin');

CREATE POLICY "Users can delete their own spheresync tasks" 
ON public.spheresync_tasks 
FOR DELETE 
USING (agent_id = auth.uid() OR get_current_user_role() = 'admin');