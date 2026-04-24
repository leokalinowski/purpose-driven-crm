-- ============================================================
-- Priority Score cadence — tiered cron + event-driven triggers
--
-- Cost strategy: rescore based on tier, not on everything every day.
--   • Daily    — unscored + Hot/Urgent (score >= 60)
--   • Weekly   — Warm (40-59)
--   • Bi-weekly — Cool (20-39)
--   • Monthly  — Cold (< 20)
--
-- Plus event-driven triggers so a contact rescores immediately when:
--   • A new contact_activities row is inserted (call/text/email/meeting logged)
--   • An opportunity's stage changes (deal momentum changed)
--
-- Each cron tick caps eligible contacts at 200 to fit comfortably in the
-- function timeout. If more are eligible, subsequent ticks will pick them up.
--
-- Cost estimate at 3,143 contacts: ~$0.60–0.90/month including event triggers.
-- ============================================================

-- 1. Ensure extensions are available (Supabase-managed; safe to re-run)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Helper function — POSTs to the edge function with a given contact_ids filter.
--    Keeps the cron job bodies short and lets us tweak the logic in one place.
CREATE OR REPLACE FUNCTION public.invoke_priority_rescore(where_clause TEXT, row_limit INT DEFAULT 200)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, net
AS $$
DECLARE
  v_ids JSONB;
  v_request_id BIGINT;
  v_sql TEXT;
BEGIN
  v_sql := format(
    'SELECT COALESCE(jsonb_agg(id), ''[]''::jsonb) FROM (SELECT id FROM public.contacts WHERE %s LIMIT %s) sub',
    where_clause, row_limit
  );
  EXECUTE v_sql INTO v_ids;

  IF v_ids = '[]'::jsonb THEN
    RAISE NOTICE 'invoke_priority_rescore: no eligible contacts for clause %', where_clause;
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url := 'https://cguoaokqwgqvzkqqezcq.supabase.co/functions/v1/compute-priority-scores',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Job', 'true'
    ),
    body := jsonb_build_object('contact_ids', v_ids),
    timeout_milliseconds := 120000
  ) INTO v_request_id;

  RAISE NOTICE 'invoke_priority_rescore fired: request_id=%, eligible=%', v_request_id, jsonb_array_length(v_ids);
  RETURN v_request_id;
END;
$$;

COMMENT ON FUNCTION public.invoke_priority_rescore IS
  'Helper used by pg_cron jobs and triggers to enqueue a batch of contacts for priority rescoring via the compute-priority-scores edge function. Capped at 200 per call to fit inside the function timeout.';

-- 3. Trigger helpers — called by AFTER INSERT/UPDATE triggers, fire-and-forget.

CREATE OR REPLACE FUNCTION public._priority_rescore_single(p_contact_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, net
AS $$
BEGIN
  IF p_contact_id IS NULL THEN RETURN; END IF;

  PERFORM net.http_post(
    url := 'https://cguoaokqwgqvzkqqezcq.supabase.co/functions/v1/compute-priority-scores',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Job', 'true'
    ),
    body := jsonb_build_object('contact_ids', jsonb_build_array(p_contact_id)),
    timeout_milliseconds := 60000
  );
END;
$$;

COMMENT ON FUNCTION public._priority_rescore_single IS
  'Fire-and-forget rescore for a single contact. Used by event-driven triggers on contact_activities + opportunities.';

-- 4. Trigger: AFTER INSERT on contact_activities → rescore that contact

CREATE OR REPLACE FUNCTION public.trg_priority_rescore_on_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, net
AS $$
BEGIN
  PERFORM public._priority_rescore_single(NEW.contact_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_priority_rescore_after_activity ON public.contact_activities;
CREATE TRIGGER trg_priority_rescore_after_activity
  AFTER INSERT ON public.contact_activities
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_priority_rescore_on_activity();

-- 5. Trigger: AFTER UPDATE on opportunities where stage changed → rescore contact

CREATE OR REPLACE FUNCTION public.trg_priority_rescore_on_stage_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, net
AS $$
BEGIN
  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    PERFORM public._priority_rescore_single(NEW.contact_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_priority_rescore_after_stage_change ON public.opportunities;
CREATE TRIGGER trg_priority_rescore_after_stage_change
  AFTER UPDATE OF stage ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_priority_rescore_on_stage_change();

-- 6. Cron jobs (tiered) — unschedule existing first so this migration is re-runnable

DO $$
DECLARE j record;
BEGIN
  FOR j IN SELECT jobid FROM cron.job WHERE jobname IN (
    'priority-rescore-hot-daily',
    'priority-rescore-warm-weekly',
    'priority-rescore-cool-biweekly',
    'priority-rescore-cold-monthly'
  ) LOOP
    PERFORM cron.unschedule(j.jobid);
  END LOOP;
END $$;

-- Daily 05:00 UTC — unscored + Hot/Urgent (>= 60) that are older than 1 day
SELECT cron.schedule(
  'priority-rescore-hot-daily',
  '0 5 * * *',
  $$ SELECT public.invoke_priority_rescore(
       'priority_score IS NULL OR (priority_score >= 60 AND (priority_computed_at IS NULL OR priority_computed_at < NOW() - INTERVAL ''1 day''))',
       200
     ) $$
);

-- Weekly Sunday 06:00 UTC — Warm (40-59) older than 7 days
SELECT cron.schedule(
  'priority-rescore-warm-weekly',
  '0 6 * * 0',
  $$ SELECT public.invoke_priority_rescore(
       'priority_score BETWEEN 40 AND 59 AND (priority_computed_at IS NULL OR priority_computed_at < NOW() - INTERVAL ''7 days'')',
       200
     ) $$
);

-- Bi-weekly (every other Wednesday) 07:00 UTC — Cool (20-39) older than 14 days
-- pg_cron doesn't support "every other week" natively; we approximate with "Wednesdays
-- where staleness > 14 days", which naturally produces a bi-weekly cadence for a given contact.
SELECT cron.schedule(
  'priority-rescore-cool-biweekly',
  '0 7 * * 3',
  $$ SELECT public.invoke_priority_rescore(
       'priority_score BETWEEN 20 AND 39 AND (priority_computed_at IS NULL OR priority_computed_at < NOW() - INTERVAL ''14 days'')',
       200
     ) $$
);

-- Monthly on the 1st at 08:00 UTC — Cold (< 20) older than 30 days
SELECT cron.schedule(
  'priority-rescore-cold-monthly',
  '0 8 1 * *',
  $$ SELECT public.invoke_priority_rescore(
       'priority_score < 20 AND (priority_computed_at IS NULL OR priority_computed_at < NOW() - INTERVAL ''30 days'')',
       200
     ) $$
);

-- 7. Sanity check view so the user can inspect what's scheduled
CREATE OR REPLACE VIEW public.v_priority_rescore_jobs AS
SELECT jobid, jobname, schedule, active, command
FROM cron.job
WHERE jobname LIKE 'priority-rescore-%'
ORDER BY jobname;

COMMENT ON VIEW public.v_priority_rescore_jobs IS
  'Inspection view — the four tiered Priority Score cron jobs. Query as SELECT * FROM v_priority_rescore_jobs.';
