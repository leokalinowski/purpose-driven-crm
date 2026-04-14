-- Drop existing broad policy
DROP POLICY IF EXISTS "Admins can manage all invitations" ON public.invitations;

-- SELECT
CREATE POLICY "Admins can select invitations"
  ON public.invitations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- INSERT
CREATE POLICY "Admins can insert invitations"
  ON public.invitations FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- UPDATE
CREATE POLICY "Admins can update invitations"
  ON public.invitations FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- DELETE
CREATE POLICY "Admins can delete invitations"
  ON public.invitations FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));