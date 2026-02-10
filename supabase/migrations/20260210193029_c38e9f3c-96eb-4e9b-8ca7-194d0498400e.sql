-- Add metricool_user_id to agent_marketing_settings for per-agent Metricool user identification
ALTER TABLE public.agent_marketing_settings
ADD COLUMN IF NOT EXISTS metricool_user_id text;