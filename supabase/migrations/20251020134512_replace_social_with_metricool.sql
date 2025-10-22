-- Replace Social Media system with Metricool integration
-- Drop existing social media tables and create Metricool-specific tables

-- Drop old social media tables
DROP TABLE IF EXISTS public.social_analytics CASCADE;
DROP TABLE IF EXISTS public.social_posts CASCADE;
DROP TABLE IF EXISTS public.social_accounts CASCADE;

-- Drop old social media storage bucket policies
DROP POLICY IF EXISTS "Users can upload their own social media files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own social media files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own social media files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own social media files" ON storage.objects;

-- Delete the social-media storage bucket
DELETE FROM storage.buckets WHERE id = 'social-media';

-- Create Metricool accounts table
CREATE TABLE public.metricool_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL,
  metricool_user_id TEXT,
  metricool_api_key TEXT,
  metricool_client_id TEXT,
  metricool_client_secret TEXT,
  embed_token TEXT,
  embed_url TEXT,
  refresh_token TEXT,
  access_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  account_name TEXT,
  account_email TEXT,
  plan_type TEXT DEFAULT 'free',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(agent_id)
);

-- Create Metricool analytics cache table (for storing aggregated metrics)
CREATE TABLE public.metricool_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  metricool_account_id UUID NOT NULL REFERENCES public.metricool_accounts(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL,
  metric_date DATE NOT NULL,
  followers_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  posts_count INTEGER DEFAULT 0,
  total_impressions INTEGER DEFAULT 0,
  total_engagements INTEGER DEFAULT 0,
  engagement_rate DECIMAL(5,2) DEFAULT 0.00,
  top_posts JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(metricool_account_id, metric_date)
);

-- Enable RLS
ALTER TABLE public.metricool_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metricool_analytics ENABLE ROW LEVEL SECURITY;

-- RLS policies for metricool_accounts
CREATE POLICY "Agents can view their own Metricool accounts"
ON public.metricool_accounts
FOR SELECT
USING (agent_id = auth.uid() OR get_current_user_role() = 'admin');

CREATE POLICY "Agents can insert their own Metricool accounts"
ON public.metricool_accounts
FOR INSERT
WITH CHECK (agent_id = auth.uid() OR get_current_user_role() = 'admin');

CREATE POLICY "Agents can update their own Metricool accounts"
ON public.metricool_accounts
FOR UPDATE
USING (agent_id = auth.uid() OR get_current_user_role() = 'admin');

CREATE POLICY "Agents can delete their own Metricool accounts"
ON public.metricool_accounts
FOR DELETE
USING (agent_id = auth.uid() OR get_current_user_role() = 'admin');

-- RLS policies for metricool_analytics
CREATE POLICY "Agents can view their own Metricool analytics"
ON public.metricool_analytics
FOR SELECT
USING (agent_id = auth.uid() OR get_current_user_role() = 'admin');

CREATE POLICY "System can insert Metricool analytics"
ON public.metricool_analytics
FOR INSERT
WITH CHECK (true);

CREATE POLICY "System can update Metricool analytics"
ON public.metricool_analytics
FOR UPDATE
USING (true);

-- Add updated_at triggers
CREATE TRIGGER update_metricool_accounts_updated_at
BEFORE UPDATE ON public.metricool_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_metricool_analytics_updated_at
BEFORE UPDATE ON public.metricool_analytics
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create Metricool integration storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('metricool-integration', 'metricool-integration', false);

-- Storage policies for Metricool bucket
CREATE POLICY "Users can upload their own Metricool files"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'metricool-integration' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own Metricool files"
ON storage.objects
FOR SELECT
USING (bucket_id = 'metricool-integration' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own Metricool files"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'metricool-integration' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own Metricool files"
ON storage.objects
FOR DELETE
USING (bucket_id = 'metricool-integration' AND auth.uid()::text = (storage.foldername(name))[1]);
