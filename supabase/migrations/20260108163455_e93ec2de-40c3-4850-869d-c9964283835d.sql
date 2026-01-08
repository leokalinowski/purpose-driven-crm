-- Add automation-related fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS gpt_prompt TEXT,
ADD COLUMN IF NOT EXISTS brand_guidelines TEXT,
ADD COLUMN IF NOT EXISTS example_copy TEXT,
ADD COLUMN IF NOT EXISTS metricool_creds JSONB,
ADD COLUMN IF NOT EXISTS clickup_social_list_id TEXT,
ADD COLUMN IF NOT EXISTS shade_folder_id TEXT,
ADD COLUMN IF NOT EXISTS editors TEXT[];

-- Add comments for documentation
COMMENT ON COLUMN public.profiles.gpt_prompt IS 'Custom ChatGPT prompt for copy generation';
COMMENT ON COLUMN public.profiles.brand_guidelines IS 'Brand guidelines for the agent';
COMMENT ON COLUMN public.profiles.example_copy IS 'Example copy for reference';
COMMENT ON COLUMN public.profiles.metricool_creds IS 'Metricool API credentials (JSON: userId, blogId, userToken)';
COMMENT ON COLUMN public.profiles.clickup_social_list_id IS 'ClickUp list ID for social deliverables';
COMMENT ON COLUMN public.profiles.shade_folder_id IS 'Shade folder ID for upload polling';
COMMENT ON COLUMN public.profiles.editors IS 'Array of editor emails for round-robin assignment';