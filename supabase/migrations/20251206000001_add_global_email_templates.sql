-- Add global email templates table for default templates across all events

CREATE TABLE IF NOT EXISTS public.global_email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email_type TEXT NOT NULL UNIQUE CHECK (email_type IN ('confirmation', 'reminder_7day', 'reminder_1day', 'thank_you', 'no_show')),
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  text_content TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.global_email_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for global templates (only admins can edit)
CREATE POLICY "Admins can view global email templates"
ON public.global_email_templates
FOR SELECT
USING (get_current_user_role() = 'admin');

CREATE POLICY "Admins can create global email templates"
ON public.global_email_templates
FOR INSERT
WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "Admins can update global email templates"
ON public.global_email_templates
FOR UPDATE
USING (get_current_user_role() = 'admin');

-- Add updated_at trigger
CREATE TRIGGER update_global_email_templates_updated_at
BEFORE UPDATE ON public.global_email_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Note: Default templates will be created via the application using the getDefaultEmailTemplate function
-- This ensures they use the beautiful HTML templates with proper branding support

