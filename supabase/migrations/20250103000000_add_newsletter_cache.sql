-- Create newsletter_cache table for content caching
CREATE TABLE public.newsletter_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.newsletter_cache ENABLE ROW LEVEL SECURITY;

-- Create policies - admins can manage cache
CREATE POLICY "Admins can manage newsletter cache"
ON public.newsletter_cache
FOR ALL
TO authenticated
USING (get_current_user_role() = 'admin')
WITH CHECK (get_current_user_role() = 'admin');

-- Create index for performance
CREATE INDEX idx_newsletter_cache_key_created ON public.newsletter_cache(cache_key, created_at DESC);

-- Create trigger for updating timestamps
CREATE TRIGGER update_newsletter_cache_updated_at
BEFORE UPDATE ON public.newsletter_cache
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
