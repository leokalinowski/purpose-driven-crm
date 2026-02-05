-- Create support_tickets table for agent support requests
CREATE TABLE public.support_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('database', 'social', 'events', 'newsletter', 'spheresync', 'technical', 'general')),
  subject TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  clickup_task_id TEXT,
  assigned_to TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Create agent_action_items table for system-generated blockers
CREATE TABLE public.agent_action_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('no_contacts', 'no_metricool', 'no_coaching', 'pending_posts', 'incomplete_profile', 'incomplete_event')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  title TEXT NOT NULL,
  description TEXT,
  action_url TEXT,
  is_dismissed BOOLEAN NOT NULL DEFAULT false,
  dismissed_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(agent_id, item_type)
);

-- Create support_config table for admin settings (assignee mappings)
CREATE TABLE public.support_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL UNIQUE CHECK (category IN ('database', 'social', 'events', 'newsletter', 'spheresync', 'technical', 'general')),
  clickup_assignee_id TEXT,
  assignee_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default config for categories
INSERT INTO public.support_config (category, assignee_name) VALUES
  ('database', 'Leonardo'),
  ('social', 'Leonardo'),
  ('events', 'Leonardo'),
  ('newsletter', 'Leonardo'),
  ('spheresync', 'Leonardo'),
  ('technical', 'Leonardo'),
  ('general', 'Leonardo');

-- Enable RLS on all tables
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies for support_tickets
CREATE POLICY "Agents can view their own tickets"
  ON public.support_tickets FOR SELECT
  USING (agent_id = auth.uid());

CREATE POLICY "Agents can create their own tickets"
  ON public.support_tickets FOR INSERT
  WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Admins can view all tickets"
  ON public.support_tickets FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update any ticket"
  ON public.support_tickets FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role full access to tickets"
  ON public.support_tickets FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- RLS Policies for agent_action_items
CREATE POLICY "Agents can view their own action items"
  ON public.agent_action_items FOR SELECT
  USING (agent_id = auth.uid());

CREATE POLICY "Agents can update their own action items"
  ON public.agent_action_items FOR UPDATE
  USING (agent_id = auth.uid());

CREATE POLICY "Admins can view all action items"
  ON public.agent_action_items FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role full access to action items"
  ON public.agent_action_items FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- RLS Policies for support_config
CREATE POLICY "Authenticated users can read support config"
  ON public.support_config FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can update support config"
  ON public.support_config FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Create indexes for performance
CREATE INDEX idx_support_tickets_agent_id ON public.support_tickets(agent_id);
CREATE INDEX idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX idx_support_tickets_created_at ON public.support_tickets(created_at DESC);
CREATE INDEX idx_agent_action_items_agent_id ON public.agent_action_items(agent_id);
CREATE INDEX idx_agent_action_items_resolved ON public.agent_action_items(resolved_at) WHERE resolved_at IS NULL;

-- Create triggers for updated_at
CREATE TRIGGER update_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_support_config_updated_at
  BEFORE UPDATE ON public.support_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();