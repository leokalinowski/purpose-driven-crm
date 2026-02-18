
-- 1. Drop unused columns from sponsors
ALTER TABLE public.sponsors
  DROP COLUMN IF EXISTS sponsorship_tier,
  DROP COLUMN IF EXISTS contract_status,
  DROP COLUMN IF EXISTS renewal_date,
  DROP COLUMN IF EXISTS contact_name,
  DROP COLUMN IF EXISTS contact_email,
  DROP COLUMN IF EXISTS contact_phone,
  DROP COLUMN IF EXISTS sponsorship_amount;

-- 2. Create sponsor_contacts table
CREATE TABLE public.sponsor_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sponsor_id uuid NOT NULL REFERENCES public.sponsors(id) ON DELETE CASCADE,
  contact_name text NOT NULL,
  contact_email text,
  contact_phone text,
  region text,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sponsor_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage sponsor contacts"
  ON public.sponsor_contacts FOR ALL
  USING (get_current_user_role() = 'admin')
  WITH CHECK (get_current_user_role() = 'admin');

-- 3. Add contribution columns to sponsor_events
ALTER TABLE public.sponsor_events
  ADD COLUMN contribution_type text,
  ADD COLUMN contribution_amount numeric,
  ADD COLUMN contribution_description text;

-- 4. Create sponsor-logos storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('sponsor-logos', 'sponsor-logos', true);

CREATE POLICY "Anyone can view sponsor logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'sponsor-logos');

CREATE POLICY "Admins can upload sponsor logos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'sponsor-logos' AND get_current_user_role() = 'admin');

CREATE POLICY "Admins can update sponsor logos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'sponsor-logos' AND get_current_user_role() = 'admin');

CREATE POLICY "Admins can delete sponsor logos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'sponsor-logos' AND get_current_user_role() = 'admin');
