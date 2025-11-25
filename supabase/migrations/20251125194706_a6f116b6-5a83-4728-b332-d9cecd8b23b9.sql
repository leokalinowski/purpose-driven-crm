-- Create email tracking table to prevent duplicate SphereSync emails
CREATE TABLE IF NOT EXISTS public.spheresync_email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  year INTEGER NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  task_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agent_id, week_number, year)
);

-- Enable RLS
ALTER TABLE public.spheresync_email_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage email logs"
  ON public.spheresync_email_logs
  FOR ALL
  USING (get_current_user_role() = 'admin')
  WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "Agents can view their own email logs"
  ON public.spheresync_email_logs
  FOR SELECT
  USING (agent_id = auth.uid() OR get_current_user_role() = 'admin');

-- Create index for faster lookups
CREATE INDEX idx_spheresync_email_logs_agent_week_year 
  ON public.spheresync_email_logs(agent_id, week_number, year);