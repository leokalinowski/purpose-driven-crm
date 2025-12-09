
-- Fix cron job for spheresync-weekly-tasks to include X-Cron-Job header
SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'spheresync-weekly-tasks'),
  command := $$
  SELECT net.http_post(
    url:='https://cguoaokqwgqvzkqqezcq.supabase.co/functions/v1/spheresync-generate-tasks',
    headers:='{"Content-Type": "application/json", "X-Cron-Job": "true", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNndW9hb2txd2dxdnprcXFlemNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0MTQ3OTEsImV4cCI6MjA2OTk5MDc5MX0.rOxOBbn4jZhCPkiCGpeNDi8_TtI8U_uZ9lvF2xvPecU"}'::jsonb,
    body:='{"mode": "global", "source": "pg_cron"}'::jsonb
  ) as request_id;
  $$
);

-- Fix cron job for spheresync-monday-emails to include X-Cron-Job header
SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'spheresync-monday-emails'),
  command := $$
  SELECT net.http_post(
    url:='https://cguoaokqwgqvzkqqezcq.supabase.co/functions/v1/spheresync-email-function',
    headers:='{"Content-Type": "application/json", "X-Cron-Job": "true", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNndW9hb2txd2dxdnprcXFlemNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0MTQ3OTEsImV4cCI6MjA2OTk5MDc5MX0.rOxOBbn4jZhCPkiCGpeNDi8_TtI8U_uZ9lvF2xvPecU"}'::jsonb,
    body:='{"source": "pg_cron"}'::jsonb
  ) as request_id;
  $$
);
