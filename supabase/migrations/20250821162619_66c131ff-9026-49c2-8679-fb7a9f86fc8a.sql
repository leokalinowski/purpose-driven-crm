-- Create social accounts table for OAuth tokens
CREATE TABLE public.social_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram', 'linkedin', 'twitter', 'tiktok')),
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  account_name TEXT,
  account_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(agent_id, platform)
);

-- Create social posts table
CREATE TABLE public.social_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL,
  platform TEXT NOT NULL,
  content TEXT NOT NULL,
  media_url TEXT,
  media_type TEXT,
  schedule_time TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'posted', 'failed', 'draft')),
  posted_at TIMESTAMP WITH TIME ZONE,
  postiz_post_id TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create social analytics table
CREATE TABLE public.social_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID,
  agent_id UUID NOT NULL,
  platform TEXT NOT NULL,
  metric_date DATE NOT NULL,
  reach INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  followers INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  engagement_rate NUMERIC DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique indexes for social_analytics
CREATE UNIQUE INDEX idx_social_analytics_post_platform_date 
ON public.social_analytics (post_id, platform, metric_date) 
WHERE post_id IS NOT NULL;

CREATE UNIQUE INDEX idx_social_analytics_agent_platform_date 
ON public.social_analytics (agent_id, platform, metric_date) 
WHERE post_id IS NULL;

-- Enable RLS on all tables
ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_analytics ENABLE ROW LEVEL SECURITY;

-- RLS policies for social_accounts
CREATE POLICY "Agents can view their own social accounts" 
ON public.social_accounts 
FOR SELECT 
USING (agent_id = auth.uid() OR get_current_user_role() = 'admin');

CREATE POLICY "Agents can insert their own social accounts" 
ON public.social_accounts 
FOR INSERT 
WITH CHECK (agent_id = auth.uid() OR get_current_user_role() = 'admin');

CREATE POLICY "Agents can update their own social accounts" 
ON public.social_accounts 
FOR UPDATE 
USING (agent_id = auth.uid() OR get_current_user_role() = 'admin');

CREATE POLICY "Agents can delete their own social accounts" 
ON public.social_accounts 
FOR DELETE 
USING (agent_id = auth.uid() OR get_current_user_role() = 'admin');

-- RLS policies for social_posts
CREATE POLICY "Agents can view their own social posts" 
ON public.social_posts 
FOR SELECT 
USING (agent_id = auth.uid() OR get_current_user_role() = 'admin');

CREATE POLICY "Agents can insert their own social posts" 
ON public.social_posts 
FOR INSERT 
WITH CHECK (agent_id = auth.uid() OR get_current_user_role() = 'admin');

CREATE POLICY "Agents can update their own social posts" 
ON public.social_posts 
FOR UPDATE 
USING (agent_id = auth.uid() OR get_current_user_role() = 'admin');

CREATE POLICY "Agents can delete their own social posts" 
ON public.social_posts 
FOR DELETE 
USING (agent_id = auth.uid() OR get_current_user_role() = 'admin');

-- RLS policies for social_analytics
CREATE POLICY "Agents can view their own social analytics" 
ON public.social_analytics 
FOR SELECT 
USING (agent_id = auth.uid() OR get_current_user_role() = 'admin');

CREATE POLICY "System can insert social analytics" 
ON public.social_analytics 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "System can update social analytics" 
ON public.social_analytics 
FOR UPDATE 
USING (true);

-- Create storage bucket for social media content
INSERT INTO storage.buckets (id, name, public) VALUES ('social-media', 'social-media', false);

-- Storage policies for social media bucket
CREATE POLICY "Users can upload their own social media files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'social-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own social media files" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'social-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own social media files" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'social-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own social media files" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'social-media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add updated_at triggers
CREATE TRIGGER update_social_accounts_updated_at
BEFORE UPDATE ON public.social_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_social_posts_updated_at
BEFORE UPDATE ON public.social_posts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_social_analytics_updated_at
BEFORE UPDATE ON public.social_analytics
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();