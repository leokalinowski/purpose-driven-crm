-- Create unified email_logs table for tracking all email communications
-- This table centralizes email logging across all systems (SphereSync, Events, Newsletters, etc.)

CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_type TEXT NOT NULL CHECK (email_type IN (
    'spheresync_reminder',
    'success_scoreboard_reminder', 
    'event_confirmation',
    'event_reminder_7day',
    'event_reminder_1day',
    'event_thank_you',
    'event_no_show',
    'newsletter',
    'team_invitation',
    'general'
  )),
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  agent_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'bounced')),
  resend_email_id TEXT, -- Resend API email ID for tracking
  error_message TEXT,
  metadata JSONB DEFAULT '{}', -- Store context like week_number, event_id, campaign_id, etc.
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  retry_count INTEGER DEFAULT 0,
  last_retry_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Only admins can access email logs
CREATE POLICY "Admins can view all email logs"
  ON public.email_logs
  FOR SELECT
  USING (get_current_user_role() = 'admin');

CREATE POLICY "Admins can insert email logs"
  ON public.email_logs
  FOR INSERT
  WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "Admins can update email logs"
  ON public.email_logs
  FOR UPDATE
  USING (get_current_user_role() = 'admin')
  WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "Admins can delete email logs"
  ON public.email_logs
  FOR DELETE
  USING (get_current_user_role() = 'admin');

-- Create indexes for better query performance
CREATE INDEX idx_email_logs_type_date 
  ON public.email_logs(email_type, created_at DESC);

CREATE INDEX idx_email_logs_agent_date 
  ON public.email_logs(agent_id, created_at DESC) 
  WHERE agent_id IS NOT NULL;

CREATE INDEX idx_email_logs_recipient 
  ON public.email_logs(recipient_email);

CREATE INDEX idx_email_logs_status 
  ON public.email_logs(status);

CREATE INDEX idx_email_logs_resend_id 
  ON public.email_logs(resend_email_id) 
  WHERE resend_email_id IS NOT NULL;

CREATE INDEX idx_email_logs_sent_at 
  ON public.email_logs(sent_at DESC) 
  WHERE sent_at IS NOT NULL;

-- Add comment for documentation
COMMENT ON TABLE public.email_logs IS 'Unified email communication log table for tracking all emails sent from the system. Admin-only access.';

