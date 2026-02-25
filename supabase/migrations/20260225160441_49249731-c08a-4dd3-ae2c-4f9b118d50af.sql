-- Create newsletter-assets storage bucket (public for email embedding)
INSERT INTO storage.buckets (id, name, public)
VALUES ('newsletter-assets', 'newsletter-assets', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: Authenticated users can upload newsletter assets
CREATE POLICY "Authenticated users can upload newsletter assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'newsletter-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

-- RLS: Anyone can read (public bucket for emails)
CREATE POLICY "Public read access for newsletter assets"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'newsletter-assets');

-- RLS: Users can delete their own uploads
CREATE POLICY "Users can delete own newsletter assets"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'newsletter-assets' AND (storage.foldername(name))[1] = auth.uid()::text);