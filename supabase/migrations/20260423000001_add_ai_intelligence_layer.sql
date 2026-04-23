-- ============================================================
-- AI Intelligence Layer
-- Adds AI scoring columns to spheresync_tasks and creates the
-- agent_intelligence_snapshots table for weekly AI snapshots.
-- All new columns are nullable — existing rows are unaffected.
-- ============================================================

-- 1. Add AI scoring columns to spheresync_tasks
ALTER TABLE public.spheresync_tasks
  ADD COLUMN IF NOT EXISTS ai_priority_score SMALLINT,        -- 1–10 priority rank
  ADD COLUMN IF NOT EXISTS ai_reason         TEXT,            -- one-sentence context
  ADD COLUMN IF NOT EXISTS ai_talking_points TEXT[],          -- 2–3 conversation openers
  ADD COLUMN IF NOT EXISTS ai_scored_at      TIMESTAMPTZ;     -- when Claude ran

-- 2. Create agent_intelligence_snapshots
CREATE TABLE IF NOT EXISTS public.agent_intelligence_snapshots (
  id                    UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id              UUID        NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  week_number           INTEGER     NOT NULL,
  year                  INTEGER     NOT NULL,
  generated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Snapshot payload (five sections)
  sphere_health         JSONB       NOT NULL DEFAULT '{}'::jsonb,
  top_opportunities     JSONB       NOT NULL DEFAULT '[]'::jsonb,
  market_pulse          JSONB       NOT NULL DEFAULT '{}'::jsonb,
  weekly_priorities     JSONB       NOT NULL DEFAULT '[]'::jsonb,
  coaching_context      JSONB       NOT NULL DEFAULT '{}'::jsonb,

  -- Metadata
  model_version         TEXT        NOT NULL DEFAULT 'claude-3-5-sonnet-20241022',
  raw_prompt_tokens     INTEGER,
  raw_completion_tokens INTEGER,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_agent_intelligence_week UNIQUE (agent_id, week_number, year)
);

-- 3. RLS
ALTER TABLE public.agent_intelligence_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agents_read_own_intelligence"
  ON public.agent_intelligence_snapshots FOR SELECT
  USING (agent_id = auth.uid() OR get_current_user_role() = 'admin');

-- 4. Index for fast weekly lookups
CREATE INDEX IF NOT EXISTS idx_agent_intelligence_agent_week
  ON public.agent_intelligence_snapshots(agent_id, year DESC, week_number DESC);

-- 5. Auto-update updated_at
CREATE TRIGGER update_agent_intelligence_snapshots_updated_at
  BEFORE UPDATE ON public.agent_intelligence_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
