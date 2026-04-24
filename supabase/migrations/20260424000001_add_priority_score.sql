-- ============================================================
-- Unified Priority Score — Phase 1 foundation
--
-- A single 0–100 score per contact that blends:
--   • Relationship health (SphereSync cadence, last touch)
--   • Pipeline momentum (active opportunity state)
--   • AI intent (market pulse + life events + engagement, via Grok)
--   • Agent flags (VIP, pre-approval, explicit watch)
--
-- Replaces the separate sphere/AI scoring dimensions with one
-- primitive that every surface (Today, Pipeline, Sphere) consumes.
-- All new columns are nullable — existing rows are unaffected.
-- ============================================================

-- 1. Add columns to contacts
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS priority_score        SMALLINT
    CHECK (priority_score IS NULL OR (priority_score >= 0 AND priority_score <= 100)),
  ADD COLUMN IF NOT EXISTS priority_reasoning    TEXT,              -- one-sentence explanation
  ADD COLUMN IF NOT EXISTS priority_components   JSONB,             -- { relationship, pipeline, intent, flags } each 0-100 weighted contribution
  ADD COLUMN IF NOT EXISTS priority_signals      JSONB,             -- raw inputs that fed the score (audit/debug)
  ADD COLUMN IF NOT EXISTS priority_computed_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS priority_model        TEXT,              -- e.g. grok-4-1-fast-reasoning
  ADD COLUMN IF NOT EXISTS priority_watch_flag   BOOLEAN NOT NULL DEFAULT false;  -- agent-set "watch this one"

COMMENT ON COLUMN public.contacts.priority_score IS
  'Unified 0–100 priority score. Blend of relationship + pipeline + AI intent + agent flags. Computed by compute-priority-scores edge function.';

COMMENT ON COLUMN public.contacts.priority_components IS
  'JSON breakdown of the weighted contribution of each component. Example: {"relationship": 28, "pipeline": 22, "intent": 18, "flags": 8} — sum = priority_score.';

COMMENT ON COLUMN public.contacts.priority_signals IS
  'JSON audit trail of inputs that fed the score. Example: {"days_since_last_activity": 12, "active_opportunity_stage": "active_search", "market_trend": "up", "life_event": "new_baby", "rsvp_count_90d": 2}.';

-- 2. Fast-path index: sort agent's contacts by priority, DESC, NULLS LAST
CREATE INDEX IF NOT EXISTS idx_contacts_priority
  ON public.contacts(agent_id, priority_score DESC NULLS LAST);

-- 3. Lookup index: "who needs re-scoring?" (stale or never-scored)
CREATE INDEX IF NOT EXISTS idx_contacts_priority_staleness
  ON public.contacts(priority_computed_at ASC NULLS FIRST);

-- 4. Watch-flag index (partial — only flagged rows)
CREATE INDEX IF NOT EXISTS idx_contacts_priority_watch
  ON public.contacts(agent_id)
  WHERE priority_watch_flag = true;

-- 5. RLS already exists on contacts; no new policies needed — these columns
--    inherit visibility from the parent row.
