-- Fix Security Definer View by using security_invoker = true
-- This ensures the view respects RLS policies of the querying user, not the view creator

DROP VIEW IF EXISTS leads_secure_summary;

-- Create the view with security_invoker = true to respect RLS of the querying user
CREATE VIEW leads_secure_summary 
WITH (security_invoker = true) -- This is the key fix for the security issue
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
FROM "Leads_Table_Agents_Name";

-- Grant SELECT to authenticated users
-- RLS from the base table will be enforced because of security_invoker = true
GRANT SELECT ON leads_secure_summary TO authenticated;

-- Ensure no anonymous access
REVOKE ALL ON leads_secure_summary FROM anon;