-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule coaching reminder for Wednesdays at 2:00 PM EDT (18:00 UTC)
-- This will send reminders to agents who haven't submitted their weekly coaching data
SELECT cron.schedule(
  'coaching-reminder',
  '0 18 * * 3',  -- Every Wednesday at 18:00 UTC (2:00 PM EDT)
  $$
  SELECT
    net.http_post(
        url:='https://cguoaokqwgqvzkqqezcq.supabase.co/functions/v1/coaching-reminder',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNndW9hb2txd2dxdnprcXFlemNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0MTQ3OTEsImV4cCI6MjA2OTk5MDc5MX0.rOxOBbn4jZhCPkiCGpeNDi8_TtI8U_uZ9lvF2xvPecU"}'::jsonb,
        body:='{"source": "cron"}'::jsonb
    ) as request_id;
  $$
);