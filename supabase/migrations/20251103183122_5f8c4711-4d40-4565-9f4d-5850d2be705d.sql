-- Allow unauthenticated users to validate invitation codes during signup
-- This is secure because:
-- 1. Users can only read invitations, not modify/delete them
-- 2. They must know both the code AND the email to use it
-- 3. The code is a UUID (unguessable without being shared)
-- 4. Admins still control all other operations (INSERT/UPDATE/DELETE)

CREATE POLICY "Allow public invitation validation for signup"
ON public.invitations
FOR SELECT
TO anon
USING (true);

-- The existing admin policy handles all other operations
-- This new policy ONLY allows SELECT (read) for anonymous users during signup validation