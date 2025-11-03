-- Replace handle_new_user function to safely parse state_licenses array
-- This fixes the "Database error saving new user" issue during signup

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_state_licenses text[];
BEGIN
  -- Safely parse state_licenses from raw_user_meta_data
  IF NEW.raw_user_meta_data ? 'state_licenses' THEN
    IF jsonb_typeof(NEW.raw_user_meta_data->'state_licenses') = 'array' THEN
      -- Extract array elements from JSONB array
      v_state_licenses := ARRAY(
        SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'state_licenses')
      );
    ELSIF jsonb_typeof(NEW.raw_user_meta_data->'state_licenses') = 'string' THEN
      -- Handle comma-separated string fallback
      v_state_licenses := string_to_array(NEW.raw_user_meta_data->>'state_licenses', ',');
    END IF;
  END IF;

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
    state_licenses
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
    v_state_licenses
  );

  RETURN NEW;
END;
$function$;