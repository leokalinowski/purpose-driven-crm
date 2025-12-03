-- Add branding fields to profiles table for agent customization
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS primary_color TEXT,
ADD COLUMN IF NOT EXISTS secondary_color TEXT,
ADD COLUMN IF NOT EXISTS headshot_url TEXT,
ADD COLUMN IF NOT EXISTS logo_colored_url TEXT,
ADD COLUMN IF NOT EXISTS logo_white_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.primary_color IS 'Primary brand color (hex code) for agent branding';
COMMENT ON COLUMN public.profiles.secondary_color IS 'Secondary brand color (hex code) for agent branding';
COMMENT ON COLUMN public.profiles.headshot_url IS 'URL to agent headshot photo';
COMMENT ON COLUMN public.profiles.logo_colored_url IS 'URL to colored version of agent logo';
COMMENT ON COLUMN public.profiles.logo_white_url IS 'URL to white version of agent logo for dark backgrounds';
