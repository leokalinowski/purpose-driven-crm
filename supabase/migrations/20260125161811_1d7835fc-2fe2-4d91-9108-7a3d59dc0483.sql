-- Add Metricool platform ID fields to agent_marketing_settings
ALTER TABLE public.agent_marketing_settings
ADD COLUMN metricool_embed_url TEXT,
ADD COLUMN metricool_instagram_id TEXT,
ADD COLUMN metricool_facebook_id TEXT,
ADD COLUMN metricool_linkedin_id TEXT,
ADD COLUMN metricool_threads_id TEXT,
ADD COLUMN metricool_tiktok_id TEXT,
ADD COLUMN metricool_twitter_id TEXT,
ADD COLUMN metricool_gmb_id TEXT,
ADD COLUMN metricool_youtube_id TEXT;

COMMENT ON COLUMN public.agent_marketing_settings.metricool_embed_url IS 'Metricool embed/iframe URL';
COMMENT ON COLUMN public.agent_marketing_settings.metricool_instagram_id IS 'Metricool Instagram platform ID';
COMMENT ON COLUMN public.agent_marketing_settings.metricool_facebook_id IS 'Metricool Facebook platform ID';
COMMENT ON COLUMN public.agent_marketing_settings.metricool_linkedin_id IS 'Metricool LinkedIn platform ID';
COMMENT ON COLUMN public.agent_marketing_settings.metricool_threads_id IS 'Metricool Threads platform ID';
COMMENT ON COLUMN public.agent_marketing_settings.metricool_tiktok_id IS 'Metricool TikTok platform ID';
COMMENT ON COLUMN public.agent_marketing_settings.metricool_twitter_id IS 'Metricool X/Twitter platform ID';
COMMENT ON COLUMN public.agent_marketing_settings.metricool_gmb_id IS 'Metricool Google My Business platform ID';
COMMENT ON COLUMN public.agent_marketing_settings.metricool_youtube_id IS 'Metricool YouTube platform ID';