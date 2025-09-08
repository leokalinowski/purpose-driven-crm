-- Add unique constraint for monthly_runs upsert functionality
ALTER TABLE public.monthly_runs 
ADD CONSTRAINT monthly_runs_agent_run_date_unique 
UNIQUE (agent_id, run_date);