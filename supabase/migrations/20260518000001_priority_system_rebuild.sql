-- ============================================================
-- Priority system rebuild — Phase 1 (backend only)
--
-- Three changes:
--   1. Add `contacts.priority_band` so every UI surface can group contacts
--      identically without re-deriving from the score on the client.
--      Values: pipeline | cadence | engagement | sphere. NULL until first
--      rescore writes it.
--
--   2. Lift the 200-row cap on `invoke_priority_rescore`. The cap existed
--      to keep Grok costs under control. The new scorer is pure SQL +
--      deterministic math (no LLM calls), so the cap is meaningless and
--      was silently leaving 53 contacts perpetually unscored.
--
--   3. Replace the 4 tiered cron jobs (hot daily / warm weekly / cool biw /
--      cold monthly) with a single 6-hourly all-rescore. Without LLM cost
--      the tiers are over-engineering — and the cadence component depends
--      on the current ISO week, so the score MUST refresh at least weekly
--      anyway. 6h cadence keeps the cadence component accurate without
--      paying a perceptible compute bill.
--
-- This migration is reversible — the old `invoke_priority_rescore` signature
-- is restored with `DROP FUNCTION IF EXISTS ... CASCADE` followed by the
-- original `CREATE OR REPLACE`. The cron jobs are listed at the bottom for
-- the same reason.
-- ============================================================

-- ─── 1. priority_band column on contacts ────────────────────────────────────

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS priority_band text;

ALTER TABLE public.contacts
  DROP CONSTRAINT IF EXISTS contacts_priority_band_check;

ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_priority_band_check
    CHECK (priority_band IS NULL
        OR priority_band IN ('pipeline', 'cadence', 'engagement', 'sphere'));

-- Index used by the queue ("show me this agent's top N grouped by band").
CREATE INDEX IF NOT EXISTS idx_contacts_agent_band_score
  ON public.contacts (agent_id, priority_band, priority_score DESC NULLS LAST)
  WHERE priority_score IS NOT NULL;

COMMENT ON COLUMN public.contacts.priority_band IS
  'Classifier for the prioritization queue. Set by compute-priority-scores '
  'based on which component dominates the weighted score. NULL until first '
  'rescore. Values: pipeline | cadence | engagement | sphere.';

-- ─── 2. Raise the rescore cap ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.invoke_priority_rescore(
  where_clause text,
  row_limit integer DEFAULT 10000
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog', 'net'
AS $function$
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

  -- Timeout bumped to 5 minutes; a full 3,500-contact rescore on the new
  -- deterministic scorer typically completes in <30s, but pg_net's default
  -- 60s was too tight when the function included LLM calls.
  SELECT net.http_post(
    url := 'https://cguoaokqwgqvzkqqezcq.supabase.co/functions/v1/compute-priority-scores',
    headers := jsonb_build_object('Content-Type', 'application/json', 'X-Cron-Job', 'true'),
    body := jsonb_build_object('contact_ids', v_ids),
    timeout_milliseconds := 300000
  ) INTO v_request_id;

  RAISE NOTICE 'invoke_priority_rescore fired: request_id=%, eligible=%',
    v_request_id, jsonb_array_length(v_ids);
  RETURN v_request_id;
END;
$function$;

COMMENT ON FUNCTION public.invoke_priority_rescore(text, integer) IS
  'Internal helper for cron jobs and event-driven rescores. Picks contact IDs '
  'matching the supplied WHERE clause (up to row_limit) and POSTs them to the '
  'compute-priority-scores edge function. Default cap raised from 200 to 10000 '
  'on 2026-05-18 when Grok was removed from the scorer.';

-- ─── 3. Consolidate cron schedule ───────────────────────────────────────────

-- Drop the old tiered schedule.
DO $$
DECLARE
  j RECORD;
BEGIN
  FOR j IN
    SELECT jobid FROM cron.job
    WHERE jobname IN (
      'priority-rescore-hot-daily',
      'priority-rescore-warm-weekly',
      'priority-rescore-cool-biweekly',
      'priority-rescore-cold-monthly'
    )
  LOOP
    PERFORM cron.unschedule(j.jobid);
  END LOOP;
END $$;

-- Single replacement: rescore every contact whose score is older than 6h
-- (or has never been scored). At ~3,500 contacts and ~30s of pure-SQL work,
-- this is comfortable to run 4x per day.
SELECT cron.schedule(
  'priority-rescore-all-6h',
  '0 */6 * * *',
  $$SELECT public.invoke_priority_rescore(
      'priority_computed_at IS NULL OR priority_computed_at < NOW() - INTERVAL ''6 hours''',
      10000
    )$$
);
