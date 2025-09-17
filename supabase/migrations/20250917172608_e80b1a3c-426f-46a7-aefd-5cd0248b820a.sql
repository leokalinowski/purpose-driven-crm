-- Fix search path security warnings for helper functions
CREATE OR REPLACE FUNCTION public.mask_email_field(email_value text) RETURNS text AS $$
BEGIN
  IF email_value IS NULL OR email_value = '' THEN
    RETURN email_value;
  END IF;
  
  -- Extract the part before @ and domain
  RETURN LEFT(email_value, 2) || '***@' || SPLIT_PART(email_value, '@', 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.mask_phone_field(phone_value text) RETURNS text AS $$
BEGIN
  IF phone_value IS NULL OR phone_value = '' THEN
    RETURN phone_value;
  END IF;
  
  -- Show only last 4 digits
  RETURN '***-***-' || RIGHT(phone_value, 4);
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;