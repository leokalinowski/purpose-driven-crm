-- ALTERNATIVE APPROACH: Create a minimal secure view
-- If this still triggers the linter, we may need to avoid views entirely

DROP VIEW IF EXISTS public.leads_secure_summary;

-- Create the simplest possible view that just exposes the already-secured data
CREATE VIEW public.leads_secure_summary AS
SELECT * FROM public."Leads_Table_Agents_Name";

-- Grant permissions
GRANT SELECT ON public.leads_secure_summary TO authenticated;