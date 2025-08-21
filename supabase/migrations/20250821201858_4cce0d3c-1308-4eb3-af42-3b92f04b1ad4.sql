-- Add unique constraint for social_accounts to prevent duplicates and enable proper upserts
ALTER TABLE public.social_accounts 
ADD CONSTRAINT unique_agent_platform 
UNIQUE (agent_id, platform);