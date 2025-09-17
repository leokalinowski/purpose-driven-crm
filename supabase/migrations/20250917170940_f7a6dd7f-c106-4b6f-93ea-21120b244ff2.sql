-- PHASE 1: CRITICAL ROLE ESCALATION FIX (CORRECTED SYNTAX)
-- Fix the profiles table UPDATE policy to prevent users from modifying their own role

-- Drop ALL existing UPDATE policies on profiles table to start clean
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile data (excluding role)" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile including roles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile (role-protected)" ON public.profiles;
DROP POLICY IF EXISTS "Secure profile updates with role protection" ON public.profiles;

-- Create a function to validate profile updates and prevent role escalation
CREATE OR REPLACE FUNCTION public.validate_profile_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow admins to update anything
  IF get_current_user_role() = 'admin' THEN
    RETURN NEW;
  END IF;
  
  -- For non-admins, prevent role changes
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    RAISE EXCEPTION 'Permission denied: Users cannot modify their own role. Contact an administrator.';
  END IF;
  
  -- Allow other profile updates for the user's own profile
  IF NEW.user_id != auth.uid() THEN
    RAISE EXCEPTION 'Permission denied: Users can only update their own profile.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to enforce profile update validation
DROP TRIGGER IF EXISTS validate_profile_updates ON public.profiles;
CREATE TRIGGER validate_profile_updates
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_profile_update();

-- Create a new secure UPDATE policy
CREATE POLICY "Profile updates with role escalation protection" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id OR get_current_user_role() = 'admin')
WITH CHECK (auth.uid() = user_id OR get_current_user_role() = 'admin');

-- Create audit logging for role changes
CREATE OR REPLACE FUNCTION public.audit_role_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Log role changes to security audit log
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    INSERT INTO public.security_audit_log (
      user_id, 
      table_name, 
      operation, 
      old_values, 
      new_values
    ) VALUES (
      auth.uid(), 
      'profiles_role_change', 
      'UPDATE',
      jsonb_build_object('user_id', OLD.user_id, 'old_role', OLD.role),
      jsonb_build_object('user_id', NEW.user_id, 'new_role', NEW.role)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for role change auditing
DROP TRIGGER IF EXISTS audit_profile_role_changes ON public.profiles;
CREATE TRIGGER audit_profile_role_changes
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  WHEN (OLD.role IS DISTINCT FROM NEW.role)
  EXECUTE FUNCTION public.audit_role_changes();

-- PHASE 2: DATA PROTECTION IMPROVEMENTS
-- Create secure view for social accounts to mask tokens
CREATE OR REPLACE VIEW public.social_accounts_secure AS
SELECT 
  id,
  agent_id,
  platform,
  account_id,
  account_name,
  -- Mask sensitive token data
  CASE 
    WHEN auth.uid() = agent_id OR get_current_user_role() = 'admin' 
    THEN LEFT(access_token, 8) || '...' 
    ELSE '[REDACTED]' 
  END as access_token_preview,
  expires_at,
  created_at,
  updated_at
FROM public.social_accounts
WHERE (agent_id = auth.uid()) OR (get_current_user_role() = 'admin');

-- Grant access to the secure view
GRANT SELECT ON public.social_accounts_secure TO authenticated;

-- Add data masking function for sensitive contact data (fixed syntax)
CREATE OR REPLACE FUNCTION public.mask_contact_data(
  contact_id uuid,
  field_name text,
  field_value text,
  requesting_user_id uuid DEFAULT auth.uid()
) RETURNS text AS $$
DECLARE
  result text;
BEGIN
  -- Only show full data to the agent who owns the contact or admins
  IF EXISTS (
    SELECT 1 FROM public.contacts c 
    WHERE c.id = contact_id 
    AND (c.agent_id = requesting_user_id OR get_current_user_role() = 'admin')
  ) THEN
    RETURN field_value;
  ELSE
    -- Return masked version for unauthorized users
    IF field_name = 'email' THEN
      result := mask_email(field_value);
    ELSIF field_name = 'phone' THEN
      result := mask_phone(field_value);
    ELSE
      result := '[PROTECTED]';
    END IF;
    
    RETURN result;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;