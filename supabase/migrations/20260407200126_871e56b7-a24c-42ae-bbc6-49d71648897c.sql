
-- =====================================================
-- FIX 1: Replace broad anon SELECT on invitations with a secure RPC
-- =====================================================

-- Drop the overly permissive anon SELECT policy
DROP POLICY IF EXISTS "Allow public invitation validation for signup" ON public.invitations;

-- Create a secure RPC that validates an invitation by code + email
CREATE OR REPLACE FUNCTION public.validate_invitation(p_code text, p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', i.id,
    'code', i.code,
    'email', i.email,
    'used', i.used,
    'expires_at', i.expires_at,
    'created_at', i.created_at
  ) INTO v_result
  FROM public.invitations i
  WHERE i.code = p_code
    AND lower(i.email) = lower(p_email)
    AND i.used = false
    AND i.expires_at > now()
  LIMIT 1;

  RETURN v_result;
END;
$$;

-- Grant execute to anon so unauthenticated signup flow works
GRANT EXECUTE ON FUNCTION public.validate_invitation(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.validate_invitation(text, text) TO authenticated;

-- =====================================================
-- FIX 2: Remove overly permissive profiles SELECT policy
-- =====================================================

-- The "Profiles select by owner or admin" policy already exists and is properly scoped
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;

-- =====================================================
-- FIX 3: Add folder-based ownership to assets bucket upload
-- =====================================================

-- Drop the old unrestricted upload policy
DROP POLICY IF EXISTS "Authenticated users can upload to assets" ON storage.objects;

-- Create a new policy: users upload to their own folder, admins can upload anywhere
CREATE POLICY "Authenticated users can upload to own assets folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'assets'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR get_current_user_role() = 'admin'
  )
);
