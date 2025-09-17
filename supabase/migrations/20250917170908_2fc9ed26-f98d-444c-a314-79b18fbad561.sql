-- PHASE 2: DATA ACCESS SECURITY IMPROVEMENTS
-- Strengthen RLS policies for critical tables to prevent cross-agent data access

-- Fix contacts table policies to ensure stricter agent isolation
DROP POLICY IF EXISTS "Agents can view their own contacts" ON public.contacts;
CREATE POLICY "Agents can view their own contacts" 
ON public.contacts 
FOR SELECT 
USING (
  (agent_id = auth.uid()) OR 
  (get_current_user_role() = 'admin')
);

-- Fix Leads_Table_Agents_Name policies for better isolation
DROP POLICY IF EXISTS "Agents can view their assigned leads" ON public."Leads_Table_Agents_Name";
CREATE POLICY "Agents can view their assigned leads" 
ON public."Leads_Table_Agents_Name" 
FOR SELECT 
USING (
  (assigned_agent_id = auth.uid()) OR 
  (get_current_user_role() = 'admin')
);

-- Strengthen social_accounts policies to prevent token exposure
DROP POLICY IF EXISTS "Agents can view their own social accounts" ON public.social_accounts;
CREATE POLICY "Agents can view their own social accounts" 
ON public.social_accounts 
FOR SELECT 
USING (
  (agent_id = auth.uid()) OR 
  (get_current_user_role() = 'admin')
);

-- Add secure view to prevent access_token exposure in social_accounts
DROP VIEW IF EXISTS public.social_accounts_secure;
CREATE VIEW public.social_accounts_secure AS
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

-- Strengthen transaction_coordination policies
DROP POLICY IF EXISTS "Enable read access for all users" ON public.transaction_coordination;
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

-- Strengthen coaching_sessions policies
DROP POLICY IF EXISTS "Users can view their own coaching sessions" ON public.coaching_sessions;
CREATE POLICY "Users can view their own coaching sessions" 
ON public.coaching_sessions 
FOR SELECT 
USING (
  (agent_id = auth.uid()) OR 
  (coach_id = auth.uid()) OR 
  (get_current_user_role() = 'admin')
);

-- Strengthen coaching_submissions policies  
DROP POLICY IF EXISTS "Agents can view their own submissions" ON public.coaching_submissions;
CREATE POLICY "Agents can view their own submissions" 
ON public.coaching_submissions 
FOR SELECT 
USING (
  (agent_id = auth.uid()) OR 
  (get_current_user_role() = 'admin')
);

-- Add data masking function for sensitive contact data
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
    CASE field_name
      WHEN 'email' THEN RETURN mask_email(field_value)
      WHEN 'phone' THEN RETURN mask_phone(field_value)
      ELSE RETURN '[PROTECTED]'
    END CASE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;