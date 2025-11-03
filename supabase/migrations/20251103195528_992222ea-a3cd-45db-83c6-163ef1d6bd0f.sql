-- Phase 2: Fix existing broken account for leokalinowskis@gmail.com
-- This manually creates the missing profile, user_role, and marks invitation as used

DO $$
DECLARE
  v_user_id uuid := 'e9a3df73-4807-403c-9346-b66f37041035';
  v_email text := 'leokalinowskis@gmail.com';
BEGIN
  -- Create profile if missing
  INSERT INTO public.profiles (
    user_id, email, role, created_at, updated_at
  )
  VALUES (
    v_user_id, v_email, 'agent', NOW(), NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- Create user_role if missing
  INSERT INTO public.user_roles (
    user_id, role, created_by
  )
  VALUES (
    v_user_id, 'agent'::app_role, v_user_id
  )
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Mark invitation as used
  UPDATE public.invitations
  SET used = true
  WHERE email = v_email
    AND used = false;

  RAISE NOTICE 'Fixed broken account for: %', v_email;
END $$;