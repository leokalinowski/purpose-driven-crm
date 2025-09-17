-- PHASE 2: DATA ACCESS SECURITY IMPROVEMENTS (FINAL CLEAN FIX)
-- Fix the duplicate policy issue and create proper data masking functions

-- Create helper functions for data masking first (these are safe to recreate)
CREATE OR REPLACE FUNCTION public.mask_email_field(email_value text) RETURNS text AS $$
BEGIN
  IF email_value IS NULL OR email_value = '' THEN
    RETURN email_value;
  END IF;
  
  -- Extract the part before @ and domain
  RETURN LEFT(email_value, 2) || '***@' || SPLIT_PART(email_value, '@', 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.mask_phone_field(phone_value text) RETURNS text AS $$
BEGIN
  IF phone_value IS NULL OR phone_value = '' THEN
    RETURN phone_value;
  END IF;
  
  -- Show only last 4 digits
  RETURN '***-***-' || RIGHT(phone_value, 4);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Drop the problematic secure view if it exists
DROP VIEW IF EXISTS public.social_accounts_secure;

-- Clean up and recreate transaction_coordination policies without duplicates
DROP POLICY IF EXISTS "Enable read access for all users" ON public.transaction_coordination;
DROP POLICY IF EXISTS "Users can view their own transaction data" ON public.transaction_coordination;

-- Create the correct transaction coordination policy
CREATE POLICY "Users can view their own transaction data" 
ON public.transaction_coordination 
FOR SELECT 
USING (
  -- Only allow access to transactions for leads assigned to the current user
  EXISTS (
    SELECT 1 FROM public."Leads_Table_Agents_Name" l 
    WHERE l.user_id = transaction_coordination.lead_id 
    AND (l.assigned_agent_id = auth.uid() OR get_current_user_role() = 'admin')
  )
);

-- Clean up and strengthen other critical policies
DROP POLICY IF EXISTS "Agents can view their own contacts" ON public.contacts;
CREATE POLICY "Agents can view their own contacts" 
ON public.contacts 
FOR SELECT 
USING (
  (agent_id = auth.uid()) OR 
  (get_current_user_role() = 'admin')
);

DROP POLICY IF EXISTS "Agents can view their assigned leads" ON public."Leads_Table_Agents_Name";
CREATE POLICY "Agents can view their assigned leads" 
ON public."Leads_Table_Agents_Name" 
FOR SELECT 
USING (
  (assigned_agent_id = auth.uid()) OR 
  (get_current_user_role() = 'admin')
);

DROP POLICY IF EXISTS "Agents can view their own social accounts" ON public.social_accounts;
CREATE POLICY "Agents can view their own social accounts" 
ON public.social_accounts 
FOR SELECT 
USING (
  (agent_id = auth.uid()) OR 
  (get_current_user_role() = 'admin')
);

DROP POLICY IF EXISTS "Users can view their own coaching sessions" ON public.coaching_sessions;
CREATE POLICY "Users can view their own coaching sessions" 
ON public.coaching_sessions 
FOR SELECT 
USING (
  (agent_id = auth.uid()) OR 
  (coach_id = auth.uid()) OR 
  (get_current_user_role() = 'admin')
);

DROP POLICY IF EXISTS "Agents can view their own submissions" ON public.coaching_submissions;
CREATE POLICY "Agents can view their own submissions" 
ON public.coaching_submissions 
FOR SELECT 
USING (
  (agent_id = auth.uid()) OR 
  (get_current_user_role() = 'admin')
);

-- Create data masking function using the helper functions
CREATE OR REPLACE FUNCTION public.mask_contact_data(
  contact_id uuid,
  field_name text,
  field_value text,
  requesting_user_id uuid DEFAULT auth.uid()
) RETURNS text AS $$
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
      RETURN mask_email_field(field_value);
    ELSIF field_name = 'phone' THEN
      RETURN mask_phone_field(field_value);
    ELSE
      RETURN '[PROTECTED]';
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;