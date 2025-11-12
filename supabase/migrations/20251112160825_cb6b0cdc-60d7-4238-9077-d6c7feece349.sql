-- Drop the problematic RLS policy that causes recursion
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

-- Create new RLS policies using get_current_user_role() to avoid recursion
CREATE POLICY "Admins and users can view roles"
ON public.user_roles
FOR SELECT
USING (
  get_current_user_role() = 'admin' OR user_id = auth.uid()
);

CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
USING (get_current_user_role() = 'admin')
WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
USING (get_current_user_role() = 'admin');