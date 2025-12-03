-- Create storage bucket for agent branding assets (headshots, logos)
INSERT INTO storage.buckets (id, name, public)
VALUES ('agent-assets', 'agent-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for agent-assets bucket
-- Allow authenticated users to upload files to their own folder
CREATE POLICY "Agents can upload their own assets"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'agent-assets' AND
  auth.role() = 'authenticated' AND
  (
    (storage.foldername(name))[1] = auth.uid()::text OR
    get_current_user_role() = 'admin'
  )
);

-- Allow authenticated users to read their own files
CREATE POLICY "Agents can view their own assets"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'agent-assets' AND
  (
    auth.role() = 'authenticated' AND
    (storage.foldername(name))[1] = auth.uid()::text OR
    get_current_user_role() = 'admin'
  )
);

-- Allow admins to manage all agent assets
CREATE POLICY "Admins can manage all agent assets"
ON storage.objects
FOR ALL
USING (
  bucket_id = 'agent-assets' AND
  get_current_user_role() = 'admin'
)
WITH CHECK (
  bucket_id = 'agent-assets' AND
  get_current_user_role() = 'admin'
);

-- Allow public read access to agent assets (for public event pages)
CREATE POLICY "Public can view agent assets"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'agent-assets'
);
