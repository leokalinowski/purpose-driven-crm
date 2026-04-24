-- ============================================================
-- SphereSync Coach — B5.8: TTL cleanup for Coach-suggested tasks
--
-- Auto-dismisses Coach tasks that:
--   • were created more than 30 days ago
--   • are still incomplete (completed = false)
--   • have not been dismissed by the agent
--
-- "Dismiss" here means setting coach_dismissed_at = now() — the rows
-- stay on disk for the learning-loop signal (Phase B+), but they stop
-- appearing in active Coach-task queries and stop counting against
-- the 7-day dedup window.
--
-- Runs daily at 04:00 UTC — just before the nightly-full Coach tick
-- at 05:00, so the next scoring run sees a clean slate.
--
-- Reference: docs/spheresync-coach-design.md § "Auto-task creation"
-- ============================================================

-- 1. Helper function — tidy idempotent sweep.
CREATE OR REPLACE FUNCTION public.sweep_stale_coach_tasks()
RETURNS TABLE(table_name TEXT, dismissed_count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_sphere_count BIGINT;
  v_pipeline_count BIGINT;
  v_cutoff TIMESTAMPTZ := NOW() - INTERVAL '30 days';
BEGIN
  UPDATE public.spheresync_tasks
    SET coach_dismissed_at = NOW()
  WHERE source = 'coach'
    AND completed = false
    AND coach_dismissed_at IS NULL
    AND coach_created_at IS NOT NULL
    AND coach_created_at < v_cutoff;
  GET DIAGNOSTICS v_sphere_count = ROW_COUNT;

  UPDATE public.pipeline_tasks
    SET coach_dismissed_at = NOW()
  WHERE source = 'coach'
    AND completed = false
    AND coach_dismissed_at IS NULL
    AND coach_created_at IS NOT NULL
    AND coach_created_at < v_cutoff;
  GET DIAGNOSTICS v_pipeline_count = ROW_COUNT;

  RETURN QUERY
    SELECT 'spheresync_tasks'::TEXT, v_sphere_count
    UNION ALL
    SELECT 'pipeline_tasks'::TEXT, v_pipeline_count;
END;
$$;

COMMENT ON FUNCTION public.sweep_stale_coach_tasks IS
  'TTL cleanup for Coach-created tasks. Sets coach_dismissed_at=now() on rows >30d old that were never completed or dismissed. Run by pg_cron daily 04:00 UTC. Returns per-table dismissed counts.';

-- 2. Schedule the cron (drop-and-recreate, so migration is re-runnable)
DO $$
DECLARE j record;
BEGIN
  FOR j IN SELECT jobid FROM cron.job WHERE jobname = 'coach-task-ttl-sweep' LOOP
    PERFORM cron.unschedule(j.jobid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'coach-task-ttl-sweep',
  '0 4 * * *',
  $$ SELECT public.sweep_stale_coach_tasks(); $$
);

-- 3. Inspection: same pattern as the other views in this project
CREATE OR REPLACE VIEW public.v_coach_task_ttl_jobs AS
SELECT jobid, jobname, schedule, active, command
FROM cron.job
WHERE jobname = 'coach-task-ttl-sweep';
