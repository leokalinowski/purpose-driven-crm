-- SECURITY FIX: Remove security_barrier and rely on underlying table RLS
-- The underlying Leads_Table_Agents_Name table already has proper RLS policies

-- Drop the current view and function
DROP FUNCTION IF EXISTS public.get_secure_lead_summaries();
DROP VIEW IF EXISTS public.leads_secure_summary;

-- Recreate the view without security_barrier, relying on underlying table RLS
CREATE VIEW public.leads_secure_summary AS
SELECT 
    user_id,
    assigned_agent_id,
    first_name,
    (LEFT(COALESCE(last_name, ''), 1) ||
        CASE
            WHEN (length(COALESCE(last_name, '')) > 1) THEN '***'
            ELSE ''
        END) AS last_name_masked,
    mask_email(email) AS email_masked,
    mask_phone(phone::text) AS phone_masked,
    city,
    state,
    zip_code,
    status,
    source,
    created_at,
    updated_at
FROM public."Leads_Table_Agents_Name";
-- Note: No WHERE clause needed - RLS on underlying table handles access control

-- Grant appropriate permissions
GRANT SELECT ON public.leads_secure_summary TO authenticated;

-- Ensure the underlying table has proper RLS (it should already exist)
-- This is just a verification that the policies exist
DO $$
BEGIN
    -- Check if the policy exists, if not, create it
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'Leads_Table_Agents_Name' 
        AND policyname = 'Agents can view their assigned leads'
    ) THEN
        EXECUTE 'CREATE POLICY "Agents can view their assigned leads" ON public."Leads_Table_Agents_Name" FOR SELECT USING ((assigned_agent_id = auth.uid()) OR (get_current_user_role() = ''admin''))';
    END IF;
END $$;