-- Create simple Metricool links table for iframe embedding
-- This replaces the complex OAuth-based Metricool integration

CREATE TABLE public.metricool_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  iframe_url TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.metricool_links ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own Metricool links"
ON public.metricool_links
FOR SELECT
USING (user_id = auth.uid() OR get_current_user_role() = 'admin');

CREATE POLICY "Users can insert their own Metricool links"
ON public.metricool_links
FOR INSERT
WITH CHECK (user_id = auth.uid() OR get_current_user_role() = 'admin');

CREATE POLICY "Users can update their own Metricool links"
ON public.metricool_links
FOR UPDATE
USING (user_id = auth.uid() OR get_current_user_role() = 'admin');

CREATE POLICY "Users can delete their own Metricool links"
ON public.metricool_links
FOR DELETE
USING (user_id = auth.uid() OR get_current_user_role() = 'admin');

-- Add updated_at trigger
CREATE TRIGGER update_metricool_links_updated_at
BEFORE UPDATE ON public.metricool_links
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample data for testing (using the provided template URL)
-- Note: Replace 'user-uuid-here' with actual user IDs when adding links
-- INSERT INTO public.metricool_links (user_id, iframe_url) VALUES
-- ('user-uuid-here', 'https://app.metricool.com/autoin/FKDRKYLFMELSISCZACRA');
