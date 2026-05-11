-- 20260430000002_sync_realtor_market_data_cron.sql
--
-- Schedule the monthly realtor.com market-data sync.
-- Realtor.com publishes the ZIP-level core metrics CSV around mid-month for
-- the prior month. We sync on the 18th at 06:00 UTC to ensure the file is up.
-- The function upserts on (zip_code, period_month), so re-runs are idempotent.
--
-- Replaces the manual `/upload-csv` flow that wrote into newsletter_market_data.
-- compute-priority-scores reads from `market_stats` directly.

-- Defensive: drop any existing schedule with this name before re-creating.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-realtor-market-data-monthly') THEN
    PERFORM cron.unschedule('sync-realtor-market-data-monthly');
  END IF;
END $$;

SELECT cron.schedule(
  'sync-realtor-market-data-monthly',
  '0 6 18 * *',  -- 18th of each month at 06:00 UTC
  $$
  SELECT net.http_post(
    url := 'https://cguoaokqwgqvzkqqezcq.supabase.co/functions/v1/sync-realtor-market-data',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNndW9hb2txd2dxdnprcXFlemNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0MTQ3OTEsImV4cCI6MjA2OTk5MDc5MX0.rOxOBnn4jZhCPkiCGpeNDi8_TtI8U_uZ9lvF2xvPecU", "X-Cron-Job": "true"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
