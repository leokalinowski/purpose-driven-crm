
-- 1. Storage RLS policies for the assets bucket
CREATE POLICY "Authenticated users can upload to assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'assets');

CREATE POLICY "Public read access for assets"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'assets');

CREATE POLICY "Admins can delete assets"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'assets' AND public.get_current_user_role() = 'admin');

-- 2. Add slides JSONB column to announcements
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS slides jsonb DEFAULT NULL;
