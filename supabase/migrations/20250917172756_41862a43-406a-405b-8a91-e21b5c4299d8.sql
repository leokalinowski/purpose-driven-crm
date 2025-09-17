-- CRITICAL SECURITY FIX: Recreate leads_secure_summary view with proper security
-- The view already has filtering logic but needs SECURITY DEFINER to work correctly

-- Drop and recreate the view with proper security definer settings
DROP VIEW IF EXISTS public.leads_secure_summary;

CREATE VIEW public.leads_secure_summary
WITH (security_barrier=true) AS
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
FROM public."Leads_Table_Agents_Name"
WHERE (
    (assigned_agent_id = auth.uid()) OR 
    (get_current_user_role() = 'admin')
);

-- Grant appropriate permissions to the view
GRANT SELECT ON public.leads_secure_summary TO authenticated;

-- Create a security definer function to access the view safely
CREATE OR REPLACE FUNCTION public.get_secure_lead_summaries()
RETURNS SETOF public.leads_secure_summary
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT * FROM public.leads_secure_summary;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.get_secure_lead_summaries() TO authenticated;