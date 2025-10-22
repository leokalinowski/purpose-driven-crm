-- Set up weekly cron job for SphereSync task generation
-- This will run every Monday at 5:30 AM UTC to generate new tasks for all agents

-- First, ensure pg_cron extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove any existing spheresync cron jobs
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'spheresync-weekly-task-generation';

-- Create new cron job for Monday 5:30 AM UTC
SELECT cron.schedule(
  'spheresync-weekly-task-generation',
  '30 5 * * 1',  -- Monday 5:30 AM UTC (adjust timezone as needed)
  $$
  SELECT
    net.http_post(
      url:='https://cguoaokqwgqvzkqqezcq.supabase.co/functions/v1/spheresync-generate-tasks',
      headers:='{"Content-Type": "application/json", "X-Cron-Job": "true"}'::jsonb,
      body:='{"source": "pg_cron", "scheduled_at": "' || now() || '"}'::jsonb
    ) as request_id;
  $$
);

-- Verify the cron job was created
SELECT jobname, schedule, active
FROM cron.job
WHERE jobname = 'spheresync-weekly-task-generation';
