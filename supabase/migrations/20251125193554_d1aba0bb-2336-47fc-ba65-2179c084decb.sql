-- Update the spheresync-monday-emails cron job to run 15 minutes after task generation
-- First unschedule the old job
SELECT cron.unschedule('spheresync-monday-emails');

-- Create new job at 5:45 AM UTC (15 minutes after task generation at 5:30 AM)
SELECT cron.schedule(
  'spheresync-monday-emails',
  '45 5 * * 1',
  $$
  SELECT net.http_post(
    url:='https://cguoaokqwgqvzkqqezcq.supabase.co/functions/v1/spheresync-email-function',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNndW9hb2txd2dxdnprcXFlemNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0MTQ3OTEsImV4cCI6MjA2OTk5MDc5MX0.rOxOBbn4jZhCPkiCGpeNDi8_TtI8U_uZ9lvF2xvPecU"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);