
-- Fix: announcements SELECT policy should be authenticated-only
DROP POLICY IF EXISTS "Enable read access for all active announcements" ON public.announcements;
CREATE POLICY "Enable read access for authenticated users"
  ON public.announcements
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Add: admin DELETE policy on announcement_dismissals
CREATE POLICY "Admins can delete dismissals"
  ON public.announcement_dismissals
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
