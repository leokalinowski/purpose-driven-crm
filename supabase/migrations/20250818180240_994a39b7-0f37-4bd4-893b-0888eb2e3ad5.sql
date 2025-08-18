-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule DNC monthly check for 1st of each month at 5 AM ET
SELECT cron.schedule(
  'dnc-monthly-check',
  '0 5 1 * *',
  $$
  SELECT net.http_post(
    url:='https://cguoaokqwgqvzkqqezcq.supabase.co/functions/v1/dnc-monthly-check',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNndW9hb2txd2dxdnprcXFlemNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0MTQ3OTEsImV4cCI6MjA2OTk5MDc5MX0.rOxOBbn4jZhCPkiCGpeNDi8_TtI8U_uZ9lvF2xvPecU"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);