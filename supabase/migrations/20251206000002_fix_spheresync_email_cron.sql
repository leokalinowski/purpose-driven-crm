-- Fix SphereSync email cron job reliability issues
-- The main issue is that the cron job uses a hardcoded JWT token that may expire
-- We'll use the anon key with proper service role permissions via the function itself

-- Remove old cron job if it exists
SELECT cron.unschedule('spheresync-monday-emails') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'spheresync-monday-emails'
);

-- Remove backup job if it exists
SELECT cron.unschedule('spheresync-tuesday-backup-emails') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'spheresync-tuesday-backup-emails'
);

-- Create improved cron job for SphereSync emails
-- Runs every Monday at 5:45 AM UTC (15 minutes after task generation at 5:30 AM)
-- Note: The function uses service role key from environment, so we use anon key here
-- The function will authenticate properly using SUPABASE_SERVICE_ROLE_KEY env var
SELECT cron.schedule(
  'spheresync-monday-emails',
  '45 5 * * 1',  -- Monday 5:45 AM UTC
  $$
  SELECT
    net.http_post(
      url:='https://cguoaokqwgqvzkqqezcq.supabase.co/functions/v1/spheresync-email-function',
      headers:='{"Content-Type": "application/json"}'::jsonb,
      body:=jsonb_build_object(
        'source', 'pg_cron',
        'scheduled_at', now()::text,
        'force', false
      )
    ) as request_id;
  $$
);

-- Create a backup cron job that runs Tuesday morning as a fallback
-- This ensures emails are sent even if Monday's cron fails
SELECT cron.schedule(
  'spheresync-tuesday-backup-emails',
  '30 6 * * 2',  -- Tuesday 6:30 AM UTC
  $$
  SELECT
    net.http_post(
      url:='https://cguoaokqwgqvzkqqezcq.supabase.co/functions/v1/spheresync-email-function',
      headers:='{"Content-Type": "application/json"}'::jsonb,
      body:=jsonb_build_object(
        'source', 'pg_cron_backup',
        'scheduled_at', now()::text,
        'force', false
      )
    ) as request_id;
  $$
);

-- Verify cron jobs were created
SELECT 
  jobname, 
  schedule, 
  active,
  command
FROM cron.job 
WHERE jobname IN ('spheresync-monday-emails', 'spheresync-tuesday-backup-emails')
ORDER BY jobname;
