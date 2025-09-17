-- Phase 1 Continued: Fix remaining database function security issues
-- Update remaining SECURITY DEFINER functions to have proper search_path settings

-- Fix handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

-- Fix get_current_user_role function
CREATE OR REPLACE FUNCTION public.get_current_user_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT role FROM public.profiles WHERE user_id = auth.uid();
$function$;

-- Fix set_lead_category function  
CREATE OR REPLACE FUNCTION public.set_lead_category()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.last_name IS NOT NULL AND length(NEW.last_name) > 0 THEN
    NEW.category = upper(left(NEW.last_name, 1));
  END IF;
  RETURN NEW;
END;
$function$;

-- Fix update_contact_activity_stats function
CREATE OR REPLACE FUNCTION public.update_contact_activity_stats()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.contacts 
  SET 
    last_activity_date = (
      SELECT MAX(activity_date) 
      FROM public.contact_activities 
      WHERE contact_id = COALESCE(NEW.contact_id, OLD.contact_id)
    ),
    activity_count = (
      SELECT COUNT(*) 
      FROM public.contact_activities 
      WHERE contact_id = COALESCE(NEW.contact_id, OLD.contact_id)
    )
  WHERE id = COALESCE(NEW.contact_id, OLD.contact_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Fix normalize_contact_phone function
CREATE OR REPLACE FUNCTION public.normalize_contact_phone()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.phone IS NOT NULL THEN
    NEW.phone := public.normalize_phone(NEW.phone);
  END IF;
  RETURN NEW;
END;
$function$;