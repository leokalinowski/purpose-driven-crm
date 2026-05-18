-- ============================================================
-- spheresync_tasks: enforce completed_at integrity
--
-- Bug discovered 2026-05-18: 6 of Leo's call-tasks were marked
-- `completed = true` with `completed_at = NULL`. The dashboard's
-- "Sphere touches" KPI (`useCompletedSphereTouchesThisWeek`)
-- filters by `completed_at >= weekStart`, so those touches were
-- invisible — the hero said 0/17 while the side widget said 6/14.
--
-- Root cause: app code in some completion paths set `completed = true`
-- without writing `completed_at`. Rather than chase every write site,
-- we enforce it at the DB level: any write that sets completed=true
-- without an explicit completed_at gets NOW() filled in. Symmetrically,
-- un-completing a task clears the timestamp so future queries don't
-- get confused.
--
-- For the backfill of existing NULL rows: rather than stamp NOW()
-- (which would pull every historical completion into "this week"), we
-- set completed_at to the SUNDAY of the task's assigned week — that
-- preserves the row inside its own week's window without polluting
-- current-week dashboards. Approximation: we don't know the exact
-- minute the agent finished the task, but the week is correct.
-- ============================================================

-- 1. Trigger function — fills completed_at when missing, clears it
--    when a task is un-completed.
CREATE OR REPLACE FUNCTION public.spheresync_task_fill_completed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  IF NEW.completed = true AND NEW.completed_at IS NULL THEN
    NEW.completed_at := NOW();
  END IF;
  IF NEW.completed = false AND NEW.completed_at IS NOT NULL THEN
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.spheresync_task_fill_completed_at() IS
  'Ensures completed_at is set whenever spheresync_tasks.completed=true. '
  'Fixes a class of bugs where dashboards filter by completed_at date range '
  'and miss completions written without the timestamp.';

-- 2. Trigger — fires on insert + update before write.
DROP TRIGGER IF EXISTS trg_spheresync_task_fill_completed_at ON public.spheresync_tasks;
CREATE TRIGGER trg_spheresync_task_fill_completed_at
  BEFORE INSERT OR UPDATE OF completed, completed_at
  ON public.spheresync_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.spheresync_task_fill_completed_at();

-- 3. Backfill: stamp existing completed=true rows that have no
--    completed_at with the SUNDAY of their assigned ISO week. This
--    keeps each completion inside its own week's window for the
--    dashboard / "touched this week" hooks, rather than pulling
--    historical completions into "today."
--
--    Caveat: we don't have the real completion timestamp, so the
--    minute is approximate. Sunday end-of-week is the best safe
--    proxy — guarantees the row stays inside its assigned week.
UPDATE public.spheresync_tasks
SET completed_at = to_date(year || '-' || lpad(week_number::text, 2, '0') || '-7', 'IYYY-IW-ID')::timestamptz
WHERE completed = true
  AND completed_at IS NULL
  AND week_number IS NOT NULL
  AND year IS NOT NULL;

-- Any leftover rows (missing week/year) get a sentinel timestamp far
-- in the past — they shouldn't pollute any current-week queries.
UPDATE public.spheresync_tasks
SET completed_at = '2020-01-01 00:00:00+00'::timestamptz
WHERE completed = true
  AND completed_at IS NULL;
