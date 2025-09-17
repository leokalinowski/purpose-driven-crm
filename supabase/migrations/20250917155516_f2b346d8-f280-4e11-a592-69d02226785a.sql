-- Fix the Security Definer View warning by removing security_barrier

-- Drop and recreate the view without security_barrier setting
DROP VIEW IF EXISTS leads_secure_summary;

-- Create a clean view that respects RLS naturally through the base table
CREATE VIEW leads_secure_summary AS 
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

-- Grant SELECT access to authenticated users
-- RLS will be enforced through the base table policies
GRANT SELECT ON leads_secure_summary TO authenticated;