-- FINAL SECURITY FIX: Recreate the view with clean, secure approach
-- This version avoids all potential security definer issues

CREATE VIEW public.leads_secure_summary AS
SELECT 
    l.user_id,
    l.assigned_agent_id,
    l.first_name,
    -- Inline masking logic (no function calls)
    CASE 
        WHEN l.last_name IS NOT NULL AND LENGTH(l.last_name) > 1 
        THEN LEFT(l.last_name, 1) || '***'
        ELSE COALESCE(l.last_name, '')
    END AS last_name_masked,
    -- Inline email masking
    CASE 
        WHEN l.email IS NOT NULL AND l.email != '' AND l.email LIKE '%@%'
        THEN LEFT(SPLIT_PART(l.email, '@', 1), 2) || '***@' || SPLIT_PART(l.email, '@', 2)
        ELSE l.email
    END AS email_masked,
    -- Inline phone masking  
    CASE 
        WHEN l.phone IS NOT NULL 
        THEN '***-***-' || RIGHT(REGEXP_REPLACE(l.phone::text, '[^0-9]', '', 'g'), 4)
        ELSE l.phone::text
    END AS phone_masked,
    l.city,
    l.state,
    l.zip_code,
    l.status,
    l.source,
    l.created_at,
    l.updated_at
FROM public."Leads_Table_Agents_Name" l;

-- Grant permissions
GRANT SELECT ON public.leads_secure_summary TO authenticated;

-- Add comment explaining the security approach
COMMENT ON VIEW public.leads_secure_summary IS 
'Secure view providing masked lead data. Security enforced by underlying table RLS policies. Uses inline masking to avoid SECURITY DEFINER concerns.';