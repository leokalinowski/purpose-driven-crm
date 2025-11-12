-- Fix profiles RLS to use get_current_user_role() instead of JWT claims
-- This allows admins to see all profiles without recursion issues

-- Drop existing JWT-based RLS policies on profiles
DROP POLICY IF EXISTS "Profiles delete by admin" ON public.profiles;
DROP POLICY IF EXISTS "Profiles insert by owner or admin" ON public.profiles;
DROP POLICY IF EXISTS "Profiles select by owner or admin" ON public.profiles;
DROP POLICY IF EXISTS "Profiles update by owner or admin" ON public.profiles;

-- Create new RLS policies using get_current_user_role()
CREATE POLICY "Profiles select by owner or admin"
ON public.profiles
FOR SELECT
USING (user_id = auth.uid() OR get_current_user_role() = 'admin');

CREATE POLICY "Profiles insert by owner or admin"
ON public.profiles
FOR INSERT
WITH CHECK (user_id = auth.uid() OR get_current_user_role() = 'admin');

CREATE POLICY "Profiles update by owner or admin"
ON public.profiles
FOR UPDATE
USING (user_id = auth.uid() OR get_current_user_role() = 'admin')
WITH CHECK (user_id = auth.uid() OR get_current_user_role() = 'admin');

CREATE POLICY "Profiles delete by admin"
ON public.profiles
FOR DELETE
USING (get_current_user_role() = 'admin');