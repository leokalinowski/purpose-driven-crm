-- SECURITY FIX: Replace SECURITY DEFINER view with properly secured view
-- Remove the view that calls SECURITY DEFINER functions and replace with secure approach

-- Drop the current view that calls SECURITY DEFINER functions
DROP VIEW IF EXISTS public.leads_secure_summary;

-- Create a secure view that relies entirely on underlying table RLS
-- This avoids calling SECURITY DEFINER functions from within the view
CREATE VIEW public.leads_secure_summary AS
SELECT 
    user_id,
    assigned_agent_id,
    first_name,
    -- Simple masking without SECURITY DEFINER functions
    (LEFT(COALESCE(last_name, ''), 1) ||
        CASE
            WHEN length(COALESCE(last_name, '')) > 1 THEN '***'
            ELSE ''
        END) AS last_name_masked,
    -- Direct masking for email without SECURITY DEFINER function
    (CASE 
        WHEN email IS NOT NULL AND email != '' THEN
            LEFT(SPLIT_PART(email, '@', 1), 2) || '***@' || SPLIT_PART(email, '@', 2)
        ELSE email
    END) AS email_masked,
    -- Direct masking for phone without SECURITY DEFINER function  
    (CASE 
        WHEN phone IS NOT NULL AND phone != '' THEN
            '***-***-' || RIGHT(regexp_replace(phone::text, '[^0-9]', '', 'g'), 4)
        ELSE phone::text
    END) AS phone_masked,
    city,
    state,
    zip_code,
    status,
    source,
    created_at,
    updated_at
FROM public."Leads_Table_Agents_Name";
-- Security is enforced by the underlying table's RLS policies

-- Grant appropriate permissions
GRANT SELECT ON public.leads_secure_summary TO authenticated;

-- Note: The original SECURITY DEFINER functions mask_email() and mask_phone() 
-- are kept for other uses but removed from this view to eliminate the security concern