-- Create comprehensive email system for RSVP events

-- Table for email templates
CREATE TABLE IF NOT EXISTS public.event_email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  email_type TEXT NOT NULL CHECK (email_type IN ('confirmation', 'reminder_7day', 'reminder_1day', 'thank_you', 'no_show')),
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  text_content TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for email tracking
CREATE TABLE IF NOT EXISTS public.event_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  rsvp_id UUID REFERENCES public.event_rsvps(id) ON DELETE CASCADE,
  email_type TEXT NOT NULL CHECK (email_type IN ('confirmation', 'reminder_7day', 'reminder_1day', 'thank_you', 'no_show')),
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  replied_at TIMESTAMP WITH TIME ZONE,
  bounced_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'opened', 'clicked', 'replied', 'bounced', 'failed')),
  resend_id TEXT, -- Resend email ID for tracking
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.event_email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_emails ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email templates
CREATE POLICY "Users can view email templates for their events"
ON public.event_email_templates
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_email_templates.event_id
    AND (e.agent_id = auth.uid() OR get_current_user_role() = 'admin')
  )
);

CREATE POLICY "Users can create email templates for their events"
ON public.event_email_templates
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_email_templates.event_id
    AND (e.agent_id = auth.uid() OR get_current_user_role() = 'admin')
  )
);

CREATE POLICY "Users can update email templates for their events"
ON public.event_email_templates
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_email_templates.event_id
    AND (e.agent_id = auth.uid() OR get_current_user_role() = 'admin')
  )
);

-- RLS Policies for email tracking
CREATE POLICY "Users can view email tracking for their events"
ON public.event_emails
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_emails.event_id
    AND (e.agent_id = auth.uid() OR get_current_user_role() = 'admin')
  )
);

-- Function to get default email templates
CREATE OR REPLACE FUNCTION public.get_default_email_template(email_type TEXT, agent_name TEXT DEFAULT '', event_title TEXT DEFAULT '', event_date TEXT DEFAULT '')
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  CASE email_type
    WHEN 'confirmation' THEN
      result := json_build_object(
        'subject', 'You''re confirmed for ' || event_title,
        'html_content', '<!DOCTYPE html><html><body><h1>RSVP Confirmed!</h1><p>Hi there,</p><p>You''re all set for <strong>' || event_title || '</strong> on {event_date}.</p><p>Hosted by {agent_name}</p><p>We''re excited to see you there!</p></body></html>',
        'text_content', 'RSVP Confirmed!\n\nYou''re all set for ' || event_title || ' on {event_date}.\n\nHosted by {agent_name}\n\nWe''re excited to see you there!'
      );
    WHEN 'reminder_7day' THEN
      result := json_build_object(
        'subject', 'Reminder: ' || event_title || ' in 7 days',
        'html_content', '<!DOCTYPE html><html><body><h1>Event Reminder</h1><p>Hi there,</p><p>This is a friendly reminder that <strong>' || event_title || '</strong> is coming up in 7 days on {event_date}.</p><p>Hosted by {agent_name}</p><p>See you there!</p></body></html>',
        'text_content', 'Event Reminder\n\nThis is a friendly reminder that ' || event_title || ' is coming up in 7 days on {event_date}.\n\nHosted by {agent_name}\n\nSee you there!'
      );
    WHEN 'reminder_1day' THEN
      result := json_build_object(
        'subject', 'Tomorrow: ' || event_title,
        'html_content', '<!DOCTYPE html><html><body><h1>Event Tomorrow!</h1><p>Hi there,</p><p>Just a quick reminder that <strong>' || event_title || '</strong> is tomorrow, {event_date}.</p><p>Hosted by {agent_name}</p><p>Looking forward to seeing you!</p></body></html>',
        'text_content', 'Event Tomorrow!\n\nJust a quick reminder that ' || event_title || ' is tomorrow, {event_date}.\n\nHosted by {agent_name}\n\nLooking forward to seeing you!'
      );
    WHEN 'thank_you' THEN
      result := json_build_object(
        'subject', 'Thank you for attending ' || event_title,
        'html_content', '<!DOCTYPE html><html><body><h1>Thank You!</h1><p>Hi there,</p><p>Thank you for attending <strong>' || event_title || '</strong>. We hope you enjoyed the event!</p><p>Hosted by {agent_name}</p><p>We''d love to hear your feedback and see you at future events.</p></body></html>',
        'text_content', 'Thank You!\n\nThank you for attending ' || event_title || '. We hope you enjoyed the event!\n\nHosted by {agent_name}\n\nWe''d love to hear your feedback and see you at future events.'
      );
    WHEN 'no_show' THEN
      result := json_build_object(
        'subject', 'We missed you at ' || event_title,
        'html_content', '<!DOCTYPE html><html><body><h1>We Missed You!</h1><p>Hi there,</p><p>We noticed you weren''t able to make it to <strong>' || event_title || '</strong>. We hope everything is okay!</p><p>Hosted by {agent_name}</p><p>We''d love to have you at our next event. Let us know if you''d like details about upcoming events.</p></body></html>',
        'text_content', 'We Missed You!\n\nWe noticed you weren''t able to make it to ' || event_title || '. We hope everything is okay!\n\nHosted by {agent_name}\n\nWe''d love to have you at our next event. Let us know if you''d like details about upcoming events.'
      );
    ELSE
      result := json_build_object(
        'subject', 'Event Update',
        'html_content', '<!DOCTYPE html><html><body><p>Hello,</p><p>This is an event update.</p></body></html>',
        'text_content', 'Hello,\n\nThis is an event update.'
      );
  END CASE;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER update_event_email_templates_updated_at
BEFORE UPDATE ON public.event_email_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_event_emails_updated_at
BEFORE UPDATE ON public.event_emails
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

