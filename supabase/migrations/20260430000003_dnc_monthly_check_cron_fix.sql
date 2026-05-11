-- 20260430000003_dnc_monthly_check_cron_fix.sql
--
-- Fix the dnc-monthly-check cron job that has been silently failing every
-- month since deploy. The original schedule (20250818180240) was missing the
-- `X-Cron-Job: true` header, so the edge function fell into the user-auth
-- path with the anon JWT, which resolves to a non-admin role, which gets
-- rejected as 403 "Admin access required for global DNC check."
--
-- Drop the broken schedule and recreate it with the header so the edge
-- function recognises the request as coming from pg_cron.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'dnc-monthly-check') THEN
    PERFORM cron.unschedule('dnc-monthly-check');
  END IF;
END $$;

SELECT cron.schedule(
  'dnc-monthly-check',
  '0 5 1 * *',  -- 1st of each month at 05:00 UTC
  $$
  SELECT net.http_post(
    url := 'https://cguoaokqwgqvzkqqezcq.supabase.co/functions/v1/dnc-monthly-check',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNndW9hb2txd2dxdnprcXFlemNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0MTQ3OTEsImV4cCI6MjA2OTk5MDc5MX0.rOxOBbn4jZhCPkiCGpeNDi8_TtI8U_uZ9lvF2xvPecU", "X-Cron-Job": "true"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
