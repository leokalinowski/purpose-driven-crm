-- Hourly cron to dispatch recurring newsletter schedules.
-- Runs at :05 of every hour to give the recurring-dispatch fn a small buffer
-- after Supabase clock-tick + avoid colliding with other crons that fire on
-- the hour exactly. The function itself filters by next_send_at <= NOW(),
-- so an hourly cadence captures any 10:00 UTC schedule by 10:05.

-- Drop any prior schedule with this name so this migration is idempotent
-- across re-runs / manual edits.
SELECT cron.unschedule(jobid)
  FROM cron.job
 WHERE jobname = 'newsletter-recurring-dispatch-hourly';

SELECT cron.schedule(
  'newsletter-recurring-dispatch-hourly',
  '5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://cguoaokqwgqvzkqqezcq.supabase.co/functions/v1/newsletter-recurring-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Job', 'true'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
