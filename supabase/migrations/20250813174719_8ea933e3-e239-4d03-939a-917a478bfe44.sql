-- Set up cron job for Monday 5:30 AM PO2 email sending
-- First enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the PO2 email function to run every Monday at 5:30 AM
SELECT cron.schedule(
  'po2-monday-emails',
  '30 5 * * 1',
  $$
  SELECT net.http_post(
    url:='https://cguoaokqwgqvzkqqezcq.supabase.co/functions/v1/po2-email-function',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNndW9hb2txd2dxdnprcXFlemNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0MTQ3OTEsImV4cCI6MjA2OTk5MDc5MX0.rOxOBbn4jZhCPkiCGpeNDi8_TtI8U_uZ9lvF2xvPecU"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);