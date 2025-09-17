-- TEMPORARY: Remove the view completely to isolate the security definer view issue
-- This will help us identify if this specific view is the problem or if there's something else

-- Drop the leads_secure_summary view temporarily
DROP VIEW IF EXISTS public.leads_secure_summary;

-- We'll recreate it once we understand what's causing the linter warning