-- Update handle_new_user function to save all agent profile data
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
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
    CASE 
      WHEN NEW.raw_user_meta_data ->> 'state_licenses' IS NOT NULL 
      THEN (NEW.raw_user_meta_data ->> 'state_licenses')::text[]
      ELSE NULL 
    END
  );
  RETURN NEW;
END;
$$;