-- Phase 1 Final: Fix any remaining function security issues
-- Check and fix any remaining functions that might need search_path settings

-- Fix normalize_phone function to be immutable with proper search_path
CREATE OR REPLACE FUNCTION public.normalize_phone(phone_input text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
BEGIN
  IF phone_input IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Remove all non-digit characters
  RETURN regexp_replace(phone_input, '[^0-9]', '', 'g');
END;
$function$;

-- Fix is_valid_phone function to be immutable with proper search_path
CREATE OR REPLACE FUNCTION public.is_valid_phone(phone_input text)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  normalized_phone TEXT;
BEGIN
  IF phone_input IS NULL THEN
    RETURN false;
  END IF;
  
  normalized_phone := public.normalize_phone(phone_input);
  
  -- Valid phone numbers should be 10-15 digits
  RETURN normalized_phone ~ '^[0-9]{10,15}$';
END;
$function$;

-- Fix format_phone_display function to be immutable with proper search_path
CREATE OR REPLACE FUNCTION public.format_phone_display(phone_input text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  normalized_phone TEXT;
BEGIN
  IF phone_input IS NULL THEN
    RETURN NULL;
  END IF;
  
  normalized_phone := public.normalize_phone(phone_input);
  
  -- Format US 10-digit numbers as (XXX) XXX-XXXX
  IF length(normalized_phone) = 10 THEN
    RETURN '(' || substring(normalized_phone, 1, 3) || ') ' || 
           substring(normalized_phone, 4, 3) || '-' || 
           substring(normalized_phone, 7, 4);
  -- Format 11-digit numbers (with country code) as +1 (XXX) XXX-XXXX
  ELSIF length(normalized_phone) = 11 AND substring(normalized_phone, 1, 1) = '1' THEN
    RETURN '+1 (' || substring(normalized_phone, 2, 3) || ') ' || 
           substring(normalized_phone, 5, 3) || '-' || 
           substring(normalized_phone, 8, 4);
  ELSE
    -- For other lengths, just return normalized
    RETURN normalized_phone;
  END IF;
END;
$function$;