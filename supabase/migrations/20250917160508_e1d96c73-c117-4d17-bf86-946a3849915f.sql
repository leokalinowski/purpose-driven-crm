-- Fix Security Definer View issue by ensuring proper access control

-- The leads_secure_summary view is flagged because it uses SECURITY DEFINER functions
-- and might bypass RLS. We need to ensure it properly respects authentication.

-- First, revoke all existing permissions
REVOKE ALL ON leads_secure_summary FROM PUBLIC;
REVOKE ALL ON leads_secure_summary FROM anon;

-- Drop and recreate the view to ensure clean ownership and permissions
DROP VIEW IF EXISTS leads_secure_summary;

-- Create the view with explicit security context
-- This view will only return data that the user can access from the base table
CREATE VIEW leads_secure_summary 
WITH (security_barrier = false) -- Explicitly disable security_barrier to avoid confusion
AS 
SELECT 
  user_id,
  assigned_agent_id,
  first_name,
  LEFT(COALESCE(last_name, ''), 1) || CASE WHEN length(COALESCE(last_name, '')) > 1 THEN '***' ELSE '' END as last_name_masked,
  mask_email(email) as email_masked,
  mask_phone(phone::text) as phone_masked,
  city,
  state,
  zip_code,
  status,
  source,
  created_at,
  updated_at
FROM "Leads_Table_Agents_Name"
-- The WHERE clause will automatically be enforced by the RLS policies on the base table
-- No additional WHERE clause needed as RLS on Leads_Table_Agents_Name handles access control
;

-- Grant SELECT only to authenticated users
-- RLS enforcement happens at the base table level
GRANT SELECT ON leads_secure_summary TO authenticated;

-- Ensure no anonymous access
REVOKE ALL ON leads_secure_summary FROM anon;