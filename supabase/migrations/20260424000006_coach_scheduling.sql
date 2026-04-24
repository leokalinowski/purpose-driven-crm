-- ============================================================
-- SphereSync Coach — B6: scheduling
--
-- Two cron jobs + two dirty-triggers that together keep each agent's
-- coaching state fresh without burning AI calls on agents whose data
-- hasn't changed.
--
-- Cron:
--   • coach-nightly-full   — 05:00 UTC daily, force=true, write_tasks=true
--                            Refreshes every agent. Writes Coach tasks.
--   • coach-workday-quick  — every 2h from 13:00-23:00 UTC (morning-to-
--                            evening US hours), dirty-only, write_tasks=false
--                            Quick refresh for agents whose data changed.
--                            Does NOT create tasks (to avoid duplication
--                            across ticks within a single day).
--
-- Event-driven dirty flags (mark a row as needing refresh on next tick):
--   • AFTER INSERT on contact_activities
--   • AFTER UPDATE on opportunities WHEN stage changed
--
-- Reference: docs/spheresync-coach-design.md § "Scheduling"
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ── Helper: mark one agent's coaching state dirty. Safe if row missing
CREATE OR REPLACE FUNCTION public._mark_coaching_dirty(p_agent_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF p_agent_id IS NULL THEN RETURN; END IF;
  -- Upsert-or-flag: if the row exists, set dirty=true; if missing, insert.
  INSERT INTO public.agent_coaching_state (agent_id, dirty)
  VALUES (p_agent_id, true)
  ON CONFLICT (agent_id) DO UPDATE SET dirty = true;
EXCEPTION WHEN OTHERS THEN
  -- Don't let a coaching-state bookkeeping problem break the parent write.
  RAISE NOTICE '_mark_coaching_dirty failed for %: %', p_agent_id, SQLERRM;
END;
$$;

COMMENT ON FUNCTION public._mark_coaching_dirty IS
  'Mark an agent_coaching_state row dirty so the next Coach tick refreshes it. Called by triggers on activity-insert and opportunity-stage-change.';

-- ── Trigger function: activity insert → agent's state dirty
CREATE OR REPLACE FUNCTION public.trg_coaching_dirty_on_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  PERFORM public._mark_coaching_dirty(NEW.agent_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_coaching_dirty_after_activity ON public.contact_activities;
CREATE TRIGGER trg_coaching_dirty_after_activity
  AFTER INSERT ON public.contact_activities
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_coaching_dirty_on_activity();

-- ── Trigger function: opportunity stage change → agent's state dirty
CREATE OR REPLACE FUNCTION public.trg_coaching_dirty_on_stage_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    PERFORM public._mark_coaching_dirty(NEW.agent_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_coaching_dirty_after_stage_change ON public.opportunities;
CREATE TRIGGER trg_coaching_dirty_after_stage_change
  AFTER UPDATE OF stage ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_coaching_dirty_on_stage_change();

-- ── Cron jobs. Drop-and-recreate so migration is re-runnable.
DO $$
DECLARE j record;
BEGIN
  FOR j IN SELECT jobid FROM cron.job WHERE jobname IN (
    'coach-nightly-full', 'coach-workday-quick'
  ) LOOP
    PERFORM cron.unschedule(j.jobid);
  END LOOP;
END $$;

-- Nightly full refresh: all agents, writes tasks.
-- 05:00 UTC = 01:00 EST / 22:00 PST prev day — before agents wake up.
SELECT cron.schedule(
  'coach-nightly-full',
  '0 5 * * *',
  $$ SELECT net.http_post(
       url := 'https://cguoaokqwgqvzkqqezcq.supabase.co/functions/v1/ai-coach-agent',
       headers := jsonb_build_object('Content-Type', 'application/json', 'X-Cron-Job', 'true'),
       body := jsonb_build_object('force', true, 'write_tasks', true),
       timeout_milliseconds := 300000
     ) $$
);

-- Workday-quick refresh: dirty agents only, does NOT write tasks.
-- Every 2 hours from 13:00-23:00 UTC (approx 08:00-18:00 US Eastern).
SELECT cron.schedule(
  'coach-workday-quick',
  '0 13,15,17,19,21,23 * * *',
  $$ SELECT net.http_post(
       url := 'https://cguoaokqwgqvzkqqezcq.supabase.co/functions/v1/ai-coach-agent',
       headers := jsonb_build_object('Content-Type', 'application/json', 'X-Cron-Job', 'true'),
       body := jsonb_build_object('write_tasks', false),
       timeout_milliseconds := 180000
     ) $$
);

-- ── Inspection
CREATE OR REPLACE VIEW public.v_coach_scheduling_jobs AS
SELECT jobid, jobname, schedule, active, command
FROM cron.job
WHERE jobname IN ('coach-nightly-full', 'coach-workday-quick', 'coach-task-ttl-sweep')
ORDER BY jobname;
