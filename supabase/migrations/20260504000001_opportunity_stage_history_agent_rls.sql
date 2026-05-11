-- Pipeline UX audit follow-up: agents could not drag cards because the
-- BEFORE-UPDATE trigger `trg_log_opportunity_stage_change` inserts into
-- `opportunity_stage_history`, but that table only had an admin-only policy.
-- Every agent-driven stage change rolled back with:
--   "new row violates row-level security policy for table opportunity_stage_history"
--
-- Fix: add agent-scoped policies (INSERT + SELECT) keyed off agent_id, mirroring
-- the pattern already used on the parent `opportunities` table. The existing
-- admin_only_stage_history policy stays for full-tenant audit access.

-- Allow agents to insert their own stage history rows (the trigger writes
-- NEW.agent_id, which equals auth.uid() because RLS already gated the parent
-- update). admin retains insert via the existing wildcard policy.
CREATE POLICY "Agents insert own stage history"
  ON public.opportunity_stage_history
  FOR INSERT
  TO authenticated
  WITH CHECK (
    agent_id = auth.uid()
    OR get_current_user_role() = 'admin'
  );

-- Allow agents to read their own stage history. Useful later for
-- per-opportunity timelines, and required if any view joins through it.
CREATE POLICY "Agents read own stage history"
  ON public.opportunity_stage_history
  FOR SELECT
  TO authenticated
  USING (
    agent_id = auth.uid()
    OR get_current_user_role() = 'admin'
  );
