-- Fix security issue: Restrict profile access to prevent email exposure
-- Drop the overly permissive policy that allows viewing all profiles
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Create a more secure policy that only allows users to view their own profile
-- and allows admins to view all profiles for administrative purposes
CREATE POLICY "Users can view their own profile and admins can view all"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id 
  OR get_current_user_role() = 'admin'
);

-- Fix the function search path security warnings by updating all functions
-- to have explicit search_path settings

-- Update update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Update handle_new_user function (already has search_path set but ensuring consistency)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, first_name, last_name, email)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    NEW.email
  );
  RETURN NEW;
END;
$function$;

-- Update get_current_user_role function
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT role FROM public.profiles WHERE user_id = auth.uid();
$function$;

-- Update set_lead_category function
CREATE OR REPLACE FUNCTION public.set_lead_category()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  IF NEW.last_name IS NOT NULL AND length(NEW.last_name) > 0 THEN
    NEW.category = upper(left(NEW.last_name, 1));
  END IF;
  RETURN NEW;
END;
$function$;