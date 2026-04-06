
-- 1. Fix profiles: Remove public SELECT, keep authenticated users can read profiles
DROP POLICY IF EXISTS "Public can view basic profile info" ON public.profiles;

-- Ensure authenticated users can still read profiles (for internal app use)
-- Check if the policy already exists first
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' AND policyname = 'Authenticated users can view profiles'
  ) THEN
    EXECUTE 'CREATE POLICY "Authenticated users can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true)';
  END IF;
END $$;

-- Create RPC for public event pages to get agent profile info without full table access
CREATE OR REPLACE FUNCTION public.get_public_event_agent_profile(p_agent_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Only return profile data for agents who have published events
  IF NOT EXISTS (
    SELECT 1 FROM events WHERE agent_id = p_agent_id AND is_published = true
  ) THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'first_name', p.first_name,
    'last_name', p.last_name,
    'team_name', p.team_name,
    'brokerage', p.brokerage,
    'phone_number', p.phone_number,
    'office_number', p.office_number,
    'office_address', p.office_address,
    'website', p.website,
    'state_licenses', p.state_licenses,
    'email', p.email
  ) INTO v_result
  FROM profiles p
  WHERE p.user_id = p_agent_id;

  RETURN v_result;
END;
$$;

-- 2. Fix user_roles: Remove public SELECT, restrict to own role + admin
DROP POLICY IF EXISTS "Public can view user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Authenticated users can view roles" ON public.user_roles;

CREATE POLICY "Users can view own role"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 3. Fix social_analytics INSERT policy self-comparison bug
DROP POLICY IF EXISTS "Authenticated services can insert social analytics" ON public.social_analytics;

CREATE POLICY "Authenticated services can insert social analytics"
ON public.social_analytics FOR INSERT
TO public
WITH CHECK (
  ((post_id IS NULL) AND (agent_id = auth.uid()))
  OR ((post_id IS NOT NULL) AND (EXISTS (
    SELECT 1 FROM social_posts sp
    WHERE sp.id = social_analytics.post_id
      AND sp.agent_id = auth.uid()
  )))
  OR (get_current_user_role() = 'admin')
);
