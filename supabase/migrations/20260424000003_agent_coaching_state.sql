-- ============================================================
-- SphereSync Coach — Phase B1 foundation
--
-- One JSONB row per agent, rewritten by the ai-coach-agent edge function
-- on every tick. The contract every downstream surface (Commander, Pipeline
-- lens, Sphere lens, contact detail, chat) reads from.
--
-- Schema is intentionally JSONB-heavy so output blocks (next_hour, today_list,
-- week_narrative, alerts, chat_context) can evolve without column-level
-- migrations. Top-level columns are observability + cache invalidation only.
--
-- Reference: docs/spheresync-coach-design.md
-- ============================================================

-- 1. Table
CREATE TABLE IF NOT EXISTS public.agent_coaching_state (
  agent_id           UUID PRIMARY KEY REFERENCES public.profiles(user_id) ON DELETE CASCADE,

  -- Cache-busting + observability
  version            INTEGER NOT NULL DEFAULT 1,
  generated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  model              TEXT,                    -- which model produced AI sections (or 'fallback')
  tokens_in          INTEGER,
  tokens_out         INTEGER,
  run_ms             INTEGER,

  -- Output blocks (see design doc for schema of each)
  next_hour          JSONB,                   -- { contact_id, action, reasoning, first_sentence, ... }
  today_list         JSONB NOT NULL DEFAULT '[]'::jsonb,
  week_narrative     JSONB,                   -- { gci_pace, pipeline_story, sphere_story, top_risk, top_win }
  alerts             JSONB NOT NULL DEFAULT '[]'::jsonb,
  chat_context       JSONB,                   -- compact grounding context for the chat feature

  -- Tick scheduling: when true, the next workday-quick tick refreshes phases 1-3
  dirty              BOOLEAN NOT NULL DEFAULT true,

  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.agent_coaching_state IS
  'SphereSync Coach output. One row per agent, rewritten on each tick. Every downstream surface reads from here. See docs/spheresync-coach-design.md.';

COMMENT ON COLUMN public.agent_coaching_state.next_hour IS
  'The single highest-leverage action for right now. JSON: {contact_id, contact_name, opportunity_id?, action, urgency, reasoning, first_sentence, context_chips[]}.';

COMMENT ON COLUMN public.agent_coaching_state.today_list IS
  'Prioritized day plan, 5-8 items. JSON array: [{contact_id, contact_name, opportunity_id?, priority_score, action, reasoning, quick_actions[]}].';

COMMENT ON COLUMN public.agent_coaching_state.week_narrative IS
  'AI-written weekly story in 5 short sentences. JSON: {gci_pace, pipeline_story, sphere_story, top_risk, top_win}.';

COMMENT ON COLUMN public.agent_coaching_state.alerts IS
  'Rule-based proactive signals. JSON array: [{level, type, message, contact_id?, opportunity_id?, created_at}].';

COMMENT ON COLUMN public.agent_coaching_state.dirty IS
  'When true, the next workday-quick tick will refresh phases 1-3 for this agent. Set by event triggers (activity insert, opportunity stage change). Reset to false by the tick.';

-- 2. RLS — agents read their own row, admins read all, only service role writes
ALTER TABLE public.agent_coaching_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agents_read_own_coaching_state"
  ON public.agent_coaching_state
  FOR SELECT
  USING (agent_id = auth.uid() OR get_current_user_role() = 'admin');

-- No INSERT/UPDATE/DELETE policies — the edge function uses the service role,
-- which bypasses RLS. Clients are read-only.

-- 3. Indexes

-- Find dirty rows fast for the workday-quick tick
CREATE INDEX IF NOT EXISTS idx_agent_coaching_state_dirty
  ON public.agent_coaching_state(updated_at ASC)
  WHERE dirty = true;

-- Staleness lookup — "who hasn't been refreshed in N hours"
CREATE INDEX IF NOT EXISTS idx_agent_coaching_state_generated_at
  ON public.agent_coaching_state(generated_at ASC NULLS FIRST);

-- 4. Auto-update updated_at on any UPDATE
DROP TRIGGER IF EXISTS update_agent_coaching_state_updated_at ON public.agent_coaching_state;
CREATE TRIGGER update_agent_coaching_state_updated_at
  BEFORE UPDATE ON public.agent_coaching_state
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Pre-populate one dirty row per existing agent so the first nightly-full
--    tick has something to update. New agents get rows lazily by the edge fn.
INSERT INTO public.agent_coaching_state (agent_id, dirty)
SELECT DISTINCT p.user_id, true
FROM public.profiles p
JOIN public.user_roles ur ON ur.user_id = p.user_id
WHERE ur.role IN ('agent', 'admin', 'editor')
ON CONFLICT (agent_id) DO NOTHING;

-- 6. Sanity-check view (admin-only — RLS inherits from underlying table)
CREATE OR REPLACE VIEW public.v_agent_coaching_state_summary AS
SELECT
  acs.agent_id,
  p.first_name || ' ' || p.last_name AS agent_name,
  acs.version,
  acs.generated_at,
  acs.model,
  acs.dirty,
  jsonb_array_length(acs.today_list) AS today_count,
  jsonb_array_length(acs.alerts) AS alert_count,
  acs.tokens_in + acs.tokens_out AS total_tokens,
  acs.run_ms,
  acs.updated_at
FROM public.agent_coaching_state acs
JOIN public.profiles p ON p.user_id = acs.agent_id
ORDER BY acs.dirty DESC, acs.generated_at ASC NULLS FIRST;

COMMENT ON VIEW public.v_agent_coaching_state_summary IS
  'Inspection view for the Coach state — one row per agent with output sizes and timing.';
