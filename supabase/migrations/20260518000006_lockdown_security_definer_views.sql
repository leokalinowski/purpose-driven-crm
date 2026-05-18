-- ============================================================
-- Lock down 5 SECURITY DEFINER views: revoke anon + authenticated grants
--
-- Audit finding (2026-05-18): 5 views in `public.` were created as
-- SECURITY DEFINER and granted SELECT/INSERT/UPDATE/DELETE/etc to BOTH
-- `anon` and `authenticated`. Combined with definer-mode (which bypasses
-- RLS on the underlying tables), this means:
--
--   - `delight_opportunities_v` exposes EVERY agent's contact PII
--     (first_name, last_name, agent_id, birthday, anniversary,
--     gift_preferences) to ANY caller with the anon key — which the
--     frontend embeds in cleartext. A `curl
--     https://<project>.supabase.co/rest/v1/delight_opportunities_v`
--     against PostgREST with the anon key dumps every agent's sphere.
--
--   - `v_agent_coaching_state_summary` exposes per-agent coaching
--     state (token counts, dirty flag, generation timestamps) joined
--     with profile names to anyone authenticated.
--
--   - `v_coach_scheduling_jobs`, `v_coach_task_ttl_jobs`,
--     `v_priority_rescore_jobs` expose `cron.job` row contents
--     (jobname, schedule, command) — the command bodies can contain
--     Bearer tokens or other secrets if any cron command hasn't been
--     migrated to vault.
--
-- The actual consumers are:
--   - `delight_opportunities_v` → ONLY `delight-daily-nudge` edge fn
--     (runs as service_role — unaffected by anon/authenticated revoke)
--   - the other 4 → ZERO consumers in src/ or supabase/functions/.
--     They're admin tooling that hasn't been mounted on any page,
--     and admin pages that need them can use service_role via an
--     edge function anyway.
--
-- Fix: REVOKE ALL on all 5 views from `anon` and `authenticated`.
-- service_role keeps full access (it's the legitimate caller for the
-- one view that's actually used). If/when admin tooling needs to
-- expose any of these, build a dedicated admin-gated edge function
-- that proxies through service_role.
-- ============================================================

REVOKE ALL ON public.delight_opportunities_v        FROM anon, authenticated;
REVOKE ALL ON public.v_agent_coaching_state_summary FROM anon, authenticated;
REVOKE ALL ON public.v_coach_scheduling_jobs        FROM anon, authenticated;
REVOKE ALL ON public.v_coach_task_ttl_jobs          FROM anon, authenticated;
REVOKE ALL ON public.v_priority_rescore_jobs        FROM anon, authenticated;

-- Explicit comment so the next reader knows this isn't accidental.
COMMENT ON VIEW public.delight_opportunities_v IS
  'SECURITY DEFINER. Revoked from anon/authenticated 2026-05-18 — exposes contact PII across all agents. Only callable via service_role (delight-daily-nudge cron). If a frontend ever needs this, build an admin-gated proxy edge function rather than re-granting.';

COMMENT ON VIEW public.v_agent_coaching_state_summary IS
  'SECURITY DEFINER. Admin-only. Revoked from anon/authenticated 2026-05-18 — joins per-agent state with profile names. Service-role only.';

COMMENT ON VIEW public.v_coach_scheduling_jobs IS
  'SECURITY DEFINER. Admin-only. Reads cron.job — command bodies may contain secrets. Service-role only.';

COMMENT ON VIEW public.v_coach_task_ttl_jobs IS
  'SECURITY DEFINER. Admin-only. Reads cron.job — command bodies may contain secrets. Service-role only.';

COMMENT ON VIEW public.v_priority_rescore_jobs IS
  'SECURITY DEFINER. Admin-only. Reads cron.job — command bodies may contain secrets. Service-role only.';
