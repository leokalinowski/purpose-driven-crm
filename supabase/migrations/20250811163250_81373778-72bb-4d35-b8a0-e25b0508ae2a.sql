-- Ensure required extensions
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Create monthly schedule (will fail if already exists with same name)
select cron.schedule(
  'monthly-zip-trends',
  '0 0 1 * *',
  $$
  select
    net.http_post(
      url := 'https://cguoaokqwgqvzkqqezcq.supabase.co/functions/v1/monthly-zip-trends',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNndW9hb2txd2dxdnprcXFlemNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0MTQ3OTEsImV4cCI6MjA2OTk5MDc5MX0.rOxOBbn4jZhCPkiCGpeNDi8_TtI8U_uZ9lvF2xvPecU"}'::jsonb,
      body := jsonb_build_object('source', 'pg_cron', 'scheduled_at', now())
    );
  $$
);
