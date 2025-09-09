-- Drop the existing constraint that prevents multiple test runs
ALTER TABLE public.monthly_runs DROP CONSTRAINT monthly_runs_agent_run_date_unique;

-- Create partial unique index (only applies to production runs where dry_run = false)
CREATE UNIQUE INDEX monthly_runs_agent_run_date_production_unique 
ON public.monthly_runs (agent_id, run_date) 
WHERE dry_run = false;

-- Clean up any stuck test records that might be blocking
DELETE FROM public.monthly_runs 
WHERE dry_run = true 
AND status = 'running' 
AND started_at < now() - interval '1 hour';