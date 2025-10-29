-- Add compliance and regulatory fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS license_number TEXT,
ADD COLUMN IF NOT EXISTS license_states TEXT[],
ADD COLUMN IF NOT EXISTS brokerage_info TEXT,
ADD COLUMN IF NOT EXISTS privacy_policy_url TEXT,
ADD COLUMN IF NOT EXISTS can_email_marketing BOOLEAN DEFAULT true;

-- Add helpful comments
COMMENT ON COLUMN public.profiles.license_number IS 'Real estate license number for compliance';
COMMENT ON COLUMN public.profiles.license_states IS 'Array of states where agent is licensed';
COMMENT ON COLUMN public.profiles.brokerage_info IS 'Brokerage name and information for compliance';
COMMENT ON COLUMN public.profiles.privacy_policy_url IS 'URL to privacy policy for email compliance';
COMMENT ON COLUMN public.profiles.can_email_marketing IS 'Whether agent is allowed to send marketing emails';