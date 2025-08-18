-- Create cron job for weekly PO2 task generation
-- This will run every Monday at 5:30 AM UTC to generate new tasks for all agents

SELECT cron.schedule(
  'po2-weekly-task-generation',
  '30 5 * * 1',  -- Monday 5:30 AM UTC
  $$
  SELECT
    net.http_post(
      url:='https://cguoaokqwgqvzkqqezcq.supabase.co/functions/v1/po2-generate-tasks',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNndW9hb2txd2dxdnprcXFlemNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0MTQ3OTEsImV4cCI6MjA2OTk5MDc5MX0.rOxOBbn4jZhCPkiCGpeNDi8_TtI8U_uZ9lvF2xvPecU"}'::jsonb,
      body:='{"mode": "global"}'::jsonb
    ) as request_id;
  $$
);

-- Check existing cron jobs
SELECT * FROM cron.job;