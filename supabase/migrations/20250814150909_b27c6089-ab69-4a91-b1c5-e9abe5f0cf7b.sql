-- Schedule daily OpenToClose sync at 6:00 AM UTC (2:00 AM EDT)
-- This will sync all transactions for all agents
SELECT cron.schedule(
  'opentoclose-daily-sync',
  '0 6 * * *',  -- Every day at 6:00 AM UTC
  $$
  SELECT
    net.http_post(
        url:='https://cguoaokqwgqvzkqqezcq.supabase.co/functions/v1/opentoclose-sync',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNndW9hb2txd2dxdnprcXFlemNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0MTQ3OTEsImV4cCI6MjA2OTk5MDc5MX0.rOxOBbn4jZhCPkiCGpeNDi8_TtI8U_uZ9lvF2xvPecU"}'::jsonb,
        body:='{"source": "cron", "syncAll": true}'::jsonb
    ) as request_id;
  $$
);