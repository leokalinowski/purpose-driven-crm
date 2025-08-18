-- Add dnc_last_checked column to contacts table
ALTER TABLE public.contacts ADD COLUMN dnc_last_checked TIMESTAMP WITH TIME ZONE;

-- Create dnc_logs table for tracking automation runs
CREATE TABLE public.dnc_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL,
  checked_count INTEGER NOT NULL DEFAULT 0,
  flagged_count INTEGER NOT NULL DEFAULT 0,
  errors TEXT,
  run_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on dnc_logs table
ALTER TABLE public.dnc_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for admins to manage dnc_logs
CREATE POLICY "Admins can manage dnc logs" 
ON public.dnc_logs 
FOR ALL 
USING (get_current_user_role() = 'admin')
WITH CHECK (get_current_user_role() = 'admin');

-- Create policy for agents to view their own dnc logs
CREATE POLICY "Agents can view their own dnc logs" 
ON public.dnc_logs 
FOR SELECT 
USING ((agent_id = auth.uid()) OR (get_current_user_role() = 'admin'));

-- Create index for better performance
CREATE INDEX idx_dnc_logs_agent_date ON public.dnc_logs(agent_id, run_date DESC);
CREATE INDEX idx_contacts_dnc_check ON public.contacts(agent_id, dnc, dnc_last_checked);