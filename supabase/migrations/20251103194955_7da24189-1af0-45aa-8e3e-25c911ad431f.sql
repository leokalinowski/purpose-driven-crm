-- Phase 1: Fix the handle_new_user trigger to be idempotent and comprehensive

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_state_licenses text[];
  v_profile_exists boolean;
  v_role_exists boolean;
BEGIN
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
    -- Update existing profile with new metadata
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
  WHERE email = NEW.email
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
$function$;