-- ============================================================
-- cron.job: add X-Cron-Secret header to all email-blast jobs
--
-- Companion to the auth hardening shipped 2026-05-18 in:
--   - supabase/functions/_shared/authGuards.ts (requireCronAuth)
--   - supabase/functions/coaching-reminder/index.ts
--   - supabase/functions/coaching-weekly-nudge/index.ts
--   - supabase/functions/delight-daily-nudge/index.ts
--   - supabase/functions/event-email-scheduler/index.ts
--   - supabase/functions/event-reminder-email/index.ts
--   - supabase/functions/dnc-monthly-check/index.ts
--
-- WHY: Before this change, cron callers were authorized by either
-- a Bearer JWT (potentially containing the service-role key) or
-- a static `X-Cron-Job: true` header. The first leaks a high-value
-- secret into every cron.job command (visible in pg_cron logs and
-- the cron.job table — readable by db_owner). The second is a
-- no-op gate any caller can spoof.
--
-- HOW: requireCronAuth in the edge function looks for an
-- `X-Cron-Secret` header and matches it against the
-- `CRON_SHARED_SECRET` env var. If the env var is unset it falls
-- back to the legacy `X-Cron-Job` check — so this rollout is
-- zero-downtime:
--
--   1. Deploy hardened edge functions (already done 2026-05-18).
--   2. Apply this migration (adds X-Cron-Secret header to cron commands).
--   3. Operator stores the secret in Supabase Vault AND sets the
--      same value as `CRON_SHARED_SECRET` env var in the Functions
--      dashboard:
--
--      SELECT vault.create_secret('THE_VALUE_HERE', 'cron_shared_secret');
--
--      After step 3 the fallback path stops being reachable and
--      the cron functions are locked down.
--
-- Until step 3 the cron commands send `X-Cron-Secret: 'unset'`
-- (because the vault row doesn't exist → COALESCE picks the literal),
-- which doesn't match anything in env, and the edge function falls
-- through to the X-Cron-Job legacy check. So cron keeps working
-- during the rollout window.
--
-- NOTE: An earlier draft of this migration tried to read the secret
-- from `current_setting('app.cron_shared_secret', true)` and ask the
-- operator to `ALTER DATABASE postgres SET ...` — but Supabase
-- managed Postgres denies that ALTER for custom GUC namespaces.
-- Vault is the supported path on this platform.
-- ============================================================

SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'coaching-reminder-wednesday'),
  command := $$
    SELECT net.http_post(
      url := 'https://cguoaokqwgqvzkqqezcq.supabase.co/functions/v1/coaching-reminder',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Cron-Job', 'true',
        'X-Cron-Secret', coalesce(
          (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_shared_secret' LIMIT 1),
          'unset'
        )
      ),
      body := jsonb_build_object('reminder_type', 'wednesday', 'source', 'pg_cron')
    );
  $$
);

SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'coaching-reminder-thursday'),
  command := $$
    SELECT net.http_post(
      url := 'https://cguoaokqwgqvzkqqezcq.supabase.co/functions/v1/coaching-reminder',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Cron-Job', 'true',
        'X-Cron-Secret', coalesce(
          (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_shared_secret' LIMIT 1),
          'unset'
        )
      ),
      body := jsonb_build_object('reminder_type', 'thursday', 'source', 'pg_cron')
    );
  $$
);

SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'coaching-weekly-nudge-wed'),
  command := $$
    SELECT net.http_post(
      url := 'https://cguoaokqwgqvzkqqezcq.supabase.co/functions/v1/coaching-weekly-nudge',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Cron-Job', 'true',
        'X-Cron-Secret', coalesce(
          (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_shared_secret' LIMIT 1),
          'unset'
        )
      ),
      body := jsonb_build_object('source', 'pg_cron')
    );
  $$
);

SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'coaching-weekly-nudge-thu'),
  command := $$
    SELECT net.http_post(
      url := 'https://cguoaokqwgqvzkqqezcq.supabase.co/functions/v1/coaching-weekly-nudge',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Cron-Job', 'true',
        'X-Cron-Secret', coalesce(
          (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_shared_secret' LIMIT 1),
          'unset'
        )
      ),
      body := jsonb_build_object('source', 'pg_cron')
    );
  $$
);

SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'coaching-weekly-nudge-fri'),
  command := $$
    SELECT net.http_post(
      url := 'https://cguoaokqwgqvzkqqezcq.supabase.co/functions/v1/coaching-weekly-nudge',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Cron-Job', 'true',
        'X-Cron-Secret', coalesce(
          (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_shared_secret' LIMIT 1),
          'unset'
        )
      ),
      body := jsonb_build_object('source', 'pg_cron')
    );
  $$
);

SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'daily-event-email-scheduler'),
  command := $$
    SELECT net.http_post(
      url := 'https://cguoaokqwgqvzkqqezcq.supabase.co/functions/v1/event-email-scheduler',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Cron-Job', 'true',
        'X-Cron-Secret', coalesce(
          (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_shared_secret' LIMIT 1),
          'unset'
        )
      ),
      body := jsonb_build_object('source', 'pg_cron')
    );
  $$
);

SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'delight-daily-nudge'),
  command := $$
    SELECT net.http_post(
      url := 'https://cguoaokqwgqvzkqqezcq.supabase.co/functions/v1/delight-daily-nudge',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Cron-Job', 'true',
        'X-Cron-Secret', coalesce(
          (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_shared_secret' LIMIT 1),
          'unset'
        )
      ),
      body := jsonb_build_object('source', 'pg_cron')
    );
  $$
);

SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'dnc-monthly-check'),
  command := $$
    SELECT net.http_post(
      url := 'https://cguoaokqwgqvzkqqezcq.supabase.co/functions/v1/dnc-monthly-check',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Cron-Job', 'true',
        'X-Cron-Secret', coalesce(
          (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_shared_secret' LIMIT 1),
          'unset'
        )
      ),
      body := jsonb_build_object('source', 'pg_cron')
    );
  $$
);
