-- Remove the conflicting foreign key constraint that references 'leads' table
-- Keep the one that references 'contacts' table since that's what we're using
ALTER TABLE public.po2_tasks 
DROP CONSTRAINT IF EXISTS po2_tasks_lead_id_fkey;