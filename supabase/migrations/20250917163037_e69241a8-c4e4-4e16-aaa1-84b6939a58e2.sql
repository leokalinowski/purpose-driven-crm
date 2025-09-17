-- Fix RLS protection on leads_secure_summary view
-- The view needs explicit RLS policies to prevent unauthorized access to sensitive customer data

-- Enable Row Level Security on the view
ALTER TABLE leads_secure_summary ENABLE ROW LEVEL SECURITY;

-- Create RLS policies on the view that mirror the base table's security
-- This ensures agents can only see their assigned leads, even through the view

-- Policy 1: Agents can view leads assigned to them
CREATE POLICY "Agents can view their assigned leads summary" 
ON leads_secure_summary 
FOR SELECT 
USING ((assigned_agent_id = auth.uid()) OR (get_current_user_role() = 'admin'::text));

-- Policy 2: Admins can view all leads (already covered in the combined policy above)
-- No separate admin policy needed since it's included in the agent policy

-- Ensure authenticated users have access but RLS policies will filter the data
GRANT SELECT ON leads_secure_summary TO authenticated;

-- Remove any public access
REVOKE ALL ON leads_secure_summary FROM PUBLIC;
REVOKE ALL ON leads_secure_summary FROM anon;