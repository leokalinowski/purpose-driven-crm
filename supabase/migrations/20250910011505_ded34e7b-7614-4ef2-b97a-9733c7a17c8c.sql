-- Clean up existing duplicate tasks, keeping only the earliest created task for each unique combination
DELETE FROM spheresync_tasks 
WHERE id NOT IN (
  SELECT DISTINCT ON (agent_id, lead_id, task_type, week_number, year) id
  FROM spheresync_tasks
  ORDER BY agent_id, lead_id, task_type, week_number, year, created_at ASC
);

-- Add unique constraint to prevent future duplicates
ALTER TABLE spheresync_tasks 
ADD CONSTRAINT spheresync_tasks_unique_per_agent_lead_week 
UNIQUE (agent_id, lead_id, task_type, week_number, year);

-- Add index for better performance on task generation queries
CREATE INDEX IF NOT EXISTS idx_spheresync_tasks_agent_week_year 
ON spheresync_tasks (agent_id, week_number, year);

-- Add index for better performance on lead-based queries
CREATE INDEX IF NOT EXISTS idx_spheresync_tasks_lead_task_type 
ON spheresync_tasks (lead_id, task_type) WHERE lead_id IS NOT NULL;