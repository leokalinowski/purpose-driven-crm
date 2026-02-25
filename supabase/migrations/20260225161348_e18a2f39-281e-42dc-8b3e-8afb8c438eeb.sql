
CREATE TABLE public.newsletter_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.newsletter_templates(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES auth.users(id),
  subject TEXT NOT NULL DEFAULT '',
  sender_name TEXT,
  recipient_filter JSONB DEFAULT '{"type": "all"}'::jsonb,
  scheduled_at TIMESTAMPTZ,
  status TEXT DEFAULT 'draft',
  sent_at TIMESTAMPTZ,
  recipient_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.newsletter_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents manage own schedules" ON public.newsletter_schedules
  FOR ALL USING (agent_id = auth.uid());

CREATE POLICY "Admins manage all schedules" ON public.newsletter_schedules
  FOR ALL USING (public.get_current_user_role() = 'admin');

CREATE TRIGGER update_newsletter_schedules_updated_at
  BEFORE UPDATE ON public.newsletter_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
