-- Create agent_images table for storing multiple images per agent
CREATE TABLE public.agent_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  image_url text NOT NULL,
  image_type text DEFAULT 'other',
  name text,
  notes text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create backgrounds table for AI-generated backgrounds
CREATE TABLE public.backgrounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  background_url text NOT NULL,
  prompt text,
  category text,
  notes text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create junction table for many-to-many background-agent links
CREATE TABLE public.background_agent_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  background_id uuid NOT NULL REFERENCES public.backgrounds(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(background_id, user_id)
);

-- Enable RLS on all tables
ALTER TABLE public.agent_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backgrounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.background_agent_links ENABLE ROW LEVEL SECURITY;

-- RLS policies for agent_images
CREATE POLICY "Admins can manage all agent images"
ON public.agent_images
FOR ALL
USING (get_current_user_role() = 'admin')
WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "Users can view their own images"
ON public.agent_images
FOR SELECT
USING ((user_id = auth.uid()) OR (get_current_user_role() = 'admin'));

-- RLS policies for backgrounds
CREATE POLICY "Admins can manage all backgrounds"
ON public.backgrounds
FOR ALL
USING (get_current_user_role() = 'admin')
WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "Authenticated users can view backgrounds"
ON public.backgrounds
FOR SELECT
USING (true);

-- RLS policies for background_agent_links
CREATE POLICY "Admins can manage all background links"
ON public.background_agent_links
FOR ALL
USING (get_current_user_role() = 'admin')
WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "Users can view their own background links"
ON public.background_agent_links
FOR SELECT
USING ((user_id = auth.uid()) OR (get_current_user_role() = 'admin'));

-- Create backgrounds storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('backgrounds', 'backgrounds', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for backgrounds bucket
CREATE POLICY "Admins can upload backgrounds"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'backgrounds' AND get_current_user_role() = 'admin');

CREATE POLICY "Admins can update backgrounds"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'backgrounds' AND get_current_user_role() = 'admin');

CREATE POLICY "Admins can delete backgrounds"
ON storage.objects
FOR DELETE
USING (bucket_id = 'backgrounds' AND get_current_user_role() = 'admin');

CREATE POLICY "Public can view backgrounds"
ON storage.objects
FOR SELECT
USING (bucket_id = 'backgrounds');

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for updated_at
CREATE TRIGGER update_agent_images_updated_at
BEFORE UPDATE ON public.agent_images
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_backgrounds_updated_at
BEFORE UPDATE ON public.backgrounds
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();