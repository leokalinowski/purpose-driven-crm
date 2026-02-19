
-- ===========================================
-- 1. global_email_templates
-- ===========================================
CREATE TABLE public.global_email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  text_content TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (email_type, is_active) -- only one active template per type
);

ALTER TABLE public.global_email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage global email templates"
  ON public.global_email_templates FOR ALL
  TO authenticated
  USING (get_current_user_role() = 'admin')
  WITH CHECK (get_current_user_role() = 'admin');

-- ===========================================
-- 2. event_email_templates
-- ===========================================
CREATE TABLE public.event_email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  email_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  text_content TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.event_email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all event email templates"
  ON public.event_email_templates FOR ALL
  TO authenticated
  USING (get_current_user_role() = 'admin')
  WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "Agents can manage templates for their events"
  ON public.event_email_templates FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = event_email_templates.event_id AND e.agent_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = event_email_templates.event_id AND e.agent_id = auth.uid()
  ));

-- ===========================================
-- 3. event_emails (tracking)
-- ===========================================
CREATE TABLE public.event_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  rsvp_id UUID REFERENCES public.event_rsvps(id) ON DELETE SET NULL,
  email_type TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  resend_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.event_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all event emails"
  ON public.event_emails FOR ALL
  TO authenticated
  USING (get_current_user_role() = 'admin')
  WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "Agents can view emails for their events"
  ON public.event_emails FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = event_emails.event_id AND e.agent_id = auth.uid()
  ));

-- Allow service role / edge functions to insert tracking records
CREATE POLICY "Service role can insert event emails"
  ON public.event_emails FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Timestamp triggers
CREATE TRIGGER update_global_email_templates_updated_at
  BEFORE UPDATE ON public.global_email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_event_email_templates_updated_at
  BEFORE UPDATE ON public.event_email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_event_emails_updated_at
  BEFORE UPDATE ON public.event_emails
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
