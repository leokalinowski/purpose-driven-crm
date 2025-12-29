-- Create spheresync_run_logs table for tracking generator and email runs
CREATE TABLE public.spheresync_run_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_type TEXT NOT NULL CHECK (run_type IN ('generate', 'email')),
  source TEXT NOT NULL DEFAULT 'unknown',
  scheduled_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  finished_at TIMESTAMP WITH TIME ZONE,
  target_week_number INTEGER NOT NULL,
  target_year INTEGER NOT NULL,
  
  -- Inputs
  force_regenerate BOOLEAN DEFAULT false,
  force_send BOOLEAN DEFAULT false,
  dry_run BOOLEAN DEFAULT false,
  target_agent_id UUID,
  
  -- Results summary
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  agents_processed INTEGER DEFAULT 0,
  agents_skipped INTEGER DEFAULT 0,
  tasks_created INTEGER DEFAULT 0,
  emails_sent INTEGER DEFAULT 0,
  emails_skipped INTEGER DEFAULT 0,
  emails_failed INTEGER DEFAULT 0,
  
  -- Detailed results (JSON for per-agent breakdown)
  agent_results JSONB DEFAULT '[]'::jsonb,
  error_message TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.spheresync_run_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view/manage run logs
CREATE POLICY "Admins can manage spheresync run logs"
  ON public.spheresync_run_logs
  FOR ALL
  USING (get_current_user_role() = 'admin')
  WITH CHECK (get_current_user_role() = 'admin');

-- Index for quick lookups
CREATE INDEX idx_spheresync_run_logs_type_week ON public.spheresync_run_logs(run_type, target_week_number, target_year);
CREATE INDEX idx_spheresync_run_logs_created ON public.spheresync_run_logs(created_at DESC);