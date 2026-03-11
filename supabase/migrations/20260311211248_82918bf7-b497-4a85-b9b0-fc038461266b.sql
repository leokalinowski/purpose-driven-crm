SELECT cron.schedule(
  'clickup-sync-event-tasks-every-2h',
  '0 */2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://cguoaokqwgqvzkqqezcq.supabase.co/functions/v1/clickup-sync-event-tasks',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNndW9hb2txd2dxdnprcXFlemNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0MTQ3OTEsImV4cCI6MjA2OTk5MDc5MX0.rOxOBbn4jZhCPkiCGpeNDi8_TtI8U_uZ9lvF2xvPecU", "X-Cron-Job": "true"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);