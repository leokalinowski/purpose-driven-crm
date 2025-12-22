-- Create newsletter_unsubscribes table for CAN-SPAM/GDPR compliance
CREATE TABLE public.newsletter_unsubscribes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  agent_id UUID NULL, -- NULL means unsubscribed from all agents
  unsubscribed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reason TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique index for efficient lookup (email + agent combo)
CREATE UNIQUE INDEX idx_newsletter_unsubscribes_email_agent 
ON public.newsletter_unsubscribes (email, COALESCE(agent_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Create index for email-only lookups
CREATE INDEX idx_newsletter_unsubscribes_email ON public.newsletter_unsubscribes (email);

-- Enable Row Level Security
ALTER TABLE public.newsletter_unsubscribes ENABLE ROW LEVEL SECURITY;

-- Admins can manage all unsubscribes
CREATE POLICY "Admins can manage unsubscribes"
ON public.newsletter_unsubscribes
FOR ALL
USING (get_current_user_role() = 'admin'::text)
WITH CHECK (get_current_user_role() = 'admin'::text);

-- Agents can view unsubscribes for their contacts
CREATE POLICY "Agents can view their unsubscribes"
ON public.newsletter_unsubscribes
FOR SELECT
USING (agent_id = auth.uid() OR get_current_user_role() = 'admin'::text);

-- Allow public inserts for unsubscribe requests (no auth needed)
CREATE POLICY "Anyone can unsubscribe"
ON public.newsletter_unsubscribes
FOR INSERT
WITH CHECK (true);

-- Add comment for documentation
COMMENT ON TABLE public.newsletter_unsubscribes IS 'Tracks email unsubscribe requests for newsletter compliance (CAN-SPAM/GDPR)';