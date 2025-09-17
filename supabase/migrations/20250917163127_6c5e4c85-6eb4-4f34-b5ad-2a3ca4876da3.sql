-- Fix sensitive lead data exposure by adding built-in access controls to the view
-- Views cannot have RLS policies, so we need to embed the security logic directly

DROP VIEW IF EXISTS leads_secure_summary;

-- Create a secure view that only shows data the current user is authorized to see
-- This prevents unauthorized access to sensitive customer data
CREATE VIEW leads_secure_summary 
WITH (security_invoker = true) 
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
-- Built-in security: Only show leads assigned to the current user OR if user is admin
WHERE (assigned_agent_id = auth.uid()) OR (get_current_user_role() = 'admin');

-- Grant access to authenticated users only
GRANT SELECT ON leads_secure_summary TO authenticated;

-- Explicitly deny anonymous access
REVOKE ALL ON leads_secure_summary FROM anon;
REVOKE ALL ON leads_secure_summary FROM PUBLIC;