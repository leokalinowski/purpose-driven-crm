-- Create coaching reminder logs table for idempotency tracking
CREATE TABLE IF NOT EXISTS public.coaching_reminder_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.profiles(user_id),
  week_number INTEGER NOT NULL,
  year INTEGER NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT now(),
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(agent_id, week_number, year)
);

-- Enable RLS
ALTER TABLE public.coaching_reminder_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies - only admins can manage
CREATE POLICY "Admins can manage coaching reminder logs"
ON public.coaching_reminder_logs
FOR ALL
USING (get_current_user_role() = 'admin')
WITH CHECK (get_current_user_role() = 'admin');

-- Add index for efficient lookups
CREATE INDEX idx_coaching_reminder_logs_lookup 
ON public.coaching_reminder_logs(agent_id, week_number, year);