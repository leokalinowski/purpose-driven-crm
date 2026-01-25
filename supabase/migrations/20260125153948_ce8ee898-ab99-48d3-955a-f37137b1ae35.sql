-- Add Metricool Brand ID field to agent_marketing_settings
ALTER TABLE public.agent_marketing_settings
ADD COLUMN metricool_brand_id TEXT;

COMMENT ON COLUMN public.agent_marketing_settings.metricool_brand_id 
IS 'Metricool Brand ID (Blog ID) for API integrations';