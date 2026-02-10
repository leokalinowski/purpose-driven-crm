
-- Step 1: Delete duplicate workflow_runs, keeping only the latest per task_id
DELETE FROM workflow_runs 
WHERE workflow_name = 'generate-copy'
AND id NOT IN (
  SELECT DISTINCT ON (input->>'task_id') id
  FROM workflow_runs
  WHERE workflow_name = 'generate-copy'
  ORDER BY input->>'task_id', created_at DESC
);

-- Step 2: Update kept runs with task-level idempotency keys and reset to queued
UPDATE workflow_runs
SET 
  idempotency_key = 'generate-copy:' || (input->>'task_id'),
  status = 'queued',
  output = NULL,
  error_message = NULL,
  started_at = NULL,
  finished_at = NULL
WHERE workflow_name = 'generate-copy';
