-- Enforce invite-only signups and remove unauthorized signup

-- 1) Delete the unauthorized user (will cascade via FK if configured)
DELETE FROM auth.users WHERE lower(email) = lower('rwilliams2500@gmail.com');

-- 2) Block any future signup unless there is a valid (unused, unexpired) invitation
CREATE OR REPLACE FUNCTION public.validate_invited_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_has_invite boolean;
BEGIN
  -- Require a valid invitation for the email being created
  SELECT EXISTS (
    SELECT 1
    FROM public.invitations i
    WHERE lower(i.email) = lower(NEW.email)
      AND i.used = false
      AND i.expires_at > now()
  ) INTO v_has_invite;

  IF NOT v_has_invite THEN
    RAISE EXCEPTION 'Invite required for signup';
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  -- Replace trigger if it already exists
  IF EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'validate_invited_signup'
  ) THEN
    DROP TRIGGER validate_invited_signup ON auth.users;
  END IF;

  CREATE TRIGGER validate_invited_signup
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_invited_signup();
END;
$$;

-- 3) Ensure handle_new_user is present and only proceeds for invited users (defense-in-depth)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_state_licenses text[];
  v_profile_exists boolean;
  v_role_exists boolean;
  v_has_invite boolean;
BEGIN
  -- Double-check invitation (should always be true if validate_invited_signup is active)
  SELECT EXISTS (
    SELECT 1
    FROM public.invitations i
    WHERE lower(i.email) = lower(NEW.email)
      AND i.used = false
      AND i.expires_at > now()
  ) INTO v_has_invite;

  IF NOT v_has_invite THEN
    -- Don't provision access if not invited
    RAISE NOTICE 'Signup blocked (no invite) for email % / user %', NEW.email, NEW.id;
    RETURN NEW;
  END IF;

  -- Safely parse state_licenses from raw_user_meta_data
  IF NEW.raw_user_meta_data ? 'state_licenses' THEN
    IF jsonb_typeof(NEW.raw_user_meta_data->'state_licenses') = 'array' THEN
      v_state_licenses := ARRAY(
        SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'state_licenses')
      );
    ELSIF jsonb_typeof(NEW.raw_user_meta_data->'state_licenses') = 'string' THEN
      v_state_licenses := string_to_array(NEW.raw_user_meta_data->>'state_licenses', ',');
    END IF;
  END IF;

  -- Check if profile already exists
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE user_id = NEW.id
  ) INTO v_profile_exists;

  -- Insert or update profile (idempotent)
  IF NOT v_profile_exists THEN
    INSERT INTO public.profiles (
      user_id,
      first_name,
      last_name,
      email,
      team_name,
      brokerage,
      phone_number,
      office_address,
      office_number,
      website,
      state_licenses,
      role
    )
    VALUES (
      NEW.id,
      NEW.raw_user_meta_data ->> 'first_name',
      NEW.raw_user_meta_data ->> 'last_name',
      NEW.email,
      NEW.raw_user_meta_data ->> 'team_name',
      NEW.raw_user_meta_data ->> 'brokerage',
      NEW.raw_user_meta_data ->> 'phone_number',
      NEW.raw_user_meta_data ->> 'office_address',
      NEW.raw_user_meta_data ->> 'office_number',
      NEW.raw_user_meta_data ->> 'website',
      v_state_licenses,
      'agent'
    );

    RAISE NOTICE 'Created profile for user %', NEW.id;
  ELSE
    UPDATE public.profiles
    SET
      first_name = COALESCE(NEW.raw_user_meta_data ->> 'first_name', first_name),
      last_name = COALESCE(NEW.raw_user_meta_data ->> 'last_name', last_name),
      team_name = COALESCE(NEW.raw_user_meta_data ->> 'team_name', team_name),
      brokerage = COALESCE(NEW.raw_user_meta_data ->> 'brokerage', brokerage),
      phone_number = COALESCE(NEW.raw_user_meta_data ->> 'phone_number', phone_number),
      office_address = COALESCE(NEW.raw_user_meta_data ->> 'office_address', office_address),
      office_number = COALESCE(NEW.raw_user_meta_data ->> 'office_number', office_number),
      website = COALESCE(NEW.raw_user_meta_data ->> 'website', website),
      state_licenses = COALESCE(v_state_licenses, state_licenses),
      updated_at = now()
    WHERE user_id = NEW.id;

    RAISE NOTICE 'Updated existing profile for user %', NEW.id;
  END IF;

  -- Check if user_role already exists
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = NEW.id
  ) INTO v_role_exists;

  -- Insert role in user_roles table (idempotent)
  IF NOT v_role_exists THEN
    INSERT INTO public.user_roles (user_id, role, created_by)
    VALUES (NEW.id, 'agent'::app_role, NEW.id)
    ON CONFLICT (user_id, role) DO NOTHING;

    RAISE NOTICE 'Created user_role for user %', NEW.id;
  END IF;

  -- Mark invitation as used (idempotent)
  UPDATE public.invitations
  SET used = true
  WHERE lower(email) = lower(NEW.email)
    AND used = false
    AND expires_at > NOW();

  IF FOUND THEN
    RAISE NOTICE 'Marked invitation as used for email %', NEW.email;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in handle_new_user for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
  END IF;
END;
$$;