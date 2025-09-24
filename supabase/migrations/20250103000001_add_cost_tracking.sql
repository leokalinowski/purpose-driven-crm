-- Create newsletter_cost_tracking table
CREATE TABLE public.newsletter_cost_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL,
  campaign_id UUID,
  grok_api_calls INTEGER NOT NULL DEFAULT 0,
  grok_tokens_used INTEGER NOT NULL DEFAULT 0,
  estimated_cost DECIMAL(10,4) NOT NULL DEFAULT 0.00,
  emails_sent INTEGER NOT NULL DEFAULT 0,
  zip_codes_processed INTEGER NOT NULL DEFAULT 0,
  cache_hits INTEGER NOT NULL DEFAULT 0,
  run_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.newsletter_cost_tracking ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage cost tracking"
ON public.newsletter_cost_tracking
FOR ALL
TO authenticated
USING (get_current_user_role() = 'admin')
WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "Agents can view their own cost tracking"
ON public.newsletter_cost_tracking
FOR SELECT
TO authenticated
USING (agent_id = auth.uid() OR get_current_user_role() = 'admin');

-- Create indexes
CREATE INDEX idx_cost_tracking_agent_date ON public.newsletter_cost_tracking(agent_id, run_date DESC);
CREATE INDEX idx_cost_tracking_campaign ON public.newsletter_cost_tracking(campaign_id);

-- Add cost tracking to monthly_runs table
ALTER TABLE public.monthly_runs ADD COLUMN IF NOT EXISTS grok_api_calls INTEGER DEFAULT 0;
ALTER TABLE public.monthly_runs ADD COLUMN IF NOT EXISTS grok_tokens_used INTEGER DEFAULT 0;
ALTER TABLE public.monthly_runs ADD COLUMN IF NOT EXISTS estimated_cost DECIMAL(10,4) DEFAULT 0.00;
ALTER TABLE public.monthly_runs ADD COLUMN IF NOT EXISTS cache_hits INTEGER DEFAULT 0;
