
-- Newsletter templates table for the visual builder
CREATE TABLE public.newsletter_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.profiles(user_id),
  name TEXT NOT NULL DEFAULT 'Monthly Newsletter',
  blocks_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  global_styles JSONB DEFAULT '{}'::jsonb,
  thumbnail_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.profiles(user_id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.newsletter_templates ENABLE ROW LEVEL SECURITY;

-- Agents can CRUD their own templates
CREATE POLICY "Agents can view their own templates"
  ON public.newsletter_templates FOR SELECT
  USING (agent_id = auth.uid() OR get_current_user_role() = 'admin');

CREATE POLICY "Agents can insert their own templates"
  ON public.newsletter_templates FOR INSERT
  WITH CHECK (agent_id = auth.uid() OR get_current_user_role() = 'admin');

CREATE POLICY "Agents can update their own templates"
  ON public.newsletter_templates FOR UPDATE
  USING (agent_id = auth.uid() OR get_current_user_role() = 'admin');

CREATE POLICY "Agents can delete their own templates"
  ON public.newsletter_templates FOR DELETE
  USING (agent_id = auth.uid() OR get_current_user_role() = 'admin');

-- Index for fast lookups
CREATE INDEX idx_newsletter_templates_agent_id ON public.newsletter_templates(agent_id);
CREATE INDEX idx_newsletter_templates_active ON public.newsletter_templates(agent_id, is_active);
