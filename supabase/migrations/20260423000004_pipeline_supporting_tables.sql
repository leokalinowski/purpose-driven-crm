-- ============================================================
-- Migration C: Pipeline Supporting Tables
-- - opportunity_stage_history  (immutable audit log)
-- - pipeline_tasks             (opportunity-specific actions)
-- - pipeline_stage_playbooks   (task templates per stage)
-- + stage-change trigger on opportunities
-- + RLS: admin-only during build phase
-- ============================================================

-- ── 1. opportunity_stage_history ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.opportunity_stage_history (
  id                  UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id      UUID        NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  agent_id            UUID        NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  from_stage          TEXT,
  to_stage            TEXT        NOT NULL,
  pipeline_type       TEXT        NOT NULL DEFAULT 'buyer',
  changed_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  days_in_from_stage  INTEGER,
  changed_by          TEXT        NOT NULL DEFAULT 'agent',
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stage_history_opportunity
  ON public.opportunity_stage_history(opportunity_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_stage_history_agent
  ON public.opportunity_stage_history(agent_id, changed_at DESC);

ALTER TABLE public.opportunity_stage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_only_stage_history"
  ON public.opportunity_stage_history FOR ALL
  USING (get_current_user_role() = 'admin');

-- ── 2. pipeline_tasks ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pipeline_tasks (
  id              UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id  UUID        NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  agent_id        UUID        NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  contact_id      UUID        REFERENCES public.contacts(id) ON DELETE SET NULL,
  task_type       TEXT        NOT NULL DEFAULT 'follow_up',
  title           TEXT        NOT NULL,
  description     TEXT,
  due_date        DATE,
  due_time        TIME,
  priority        SMALLINT    DEFAULT 5,
  completed       BOOLEAN     NOT NULL DEFAULT FALSE,
  completed_at    TIMESTAMPTZ,
  auto_generated  BOOLEAN     NOT NULL DEFAULT FALSE,
  playbook_stage  TEXT,
  ai_suggested    BOOLEAN     DEFAULT FALSE,
  sort_order      SMALLINT    DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_tasks_opportunity
  ON public.pipeline_tasks(opportunity_id, completed, due_date);

CREATE INDEX IF NOT EXISTS idx_pipeline_tasks_agent_due
  ON public.pipeline_tasks(agent_id, completed, due_date)
  WHERE completed = FALSE;

ALTER TABLE public.pipeline_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_only_pipeline_tasks"
  ON public.pipeline_tasks FOR ALL
  USING (get_current_user_role() = 'admin');

-- auto-update updated_at
CREATE TRIGGER update_pipeline_tasks_updated_at
  BEFORE UPDATE ON public.pipeline_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── 3. pipeline_stage_playbooks ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pipeline_stage_playbooks (
  id              UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id        UUID        REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  -- NULL = system default; non-null = agent override
  pipeline_type   TEXT        NOT NULL,
  stage           TEXT        NOT NULL,
  task_type       TEXT        NOT NULL DEFAULT 'follow_up',
  title           TEXT        NOT NULL,
  description     TEXT,
  due_days_offset SMALLINT    DEFAULT 1,
  priority        SMALLINT    DEFAULT 5,
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order      SMALLINT    DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_playbooks_lookup
  ON public.pipeline_stage_playbooks(pipeline_type, stage, is_active)
  WHERE is_active = TRUE;

ALTER TABLE public.pipeline_stage_playbooks ENABLE ROW LEVEL SECURITY;

-- Everyone can read playbooks (needed for task generation)
CREATE POLICY "read_playbooks"
  ON public.pipeline_stage_playbooks FOR SELECT
  USING (agent_id IS NULL OR agent_id = auth.uid() OR get_current_user_role() = 'admin');

-- Only admins (or the owning agent) can write
CREATE POLICY "admin_write_playbooks"
  ON public.pipeline_stage_playbooks FOR INSERT WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "agent_write_own_playbooks"
  ON public.pipeline_stage_playbooks FOR UPDATE
  USING (agent_id = auth.uid() OR get_current_user_role() = 'admin');

CREATE POLICY "agent_delete_own_playbooks"
  ON public.pipeline_stage_playbooks FOR DELETE
  USING (agent_id = auth.uid() OR get_current_user_role() = 'admin');

-- ── 4. Stage-change trigger on opportunities ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_opportunity_stage_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_days_in_from INTEGER := NULL;
  v_pipeline_type TEXT;
BEGIN
  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    -- Compute days spent in the previous stage
    IF OLD.stage IS NOT NULL AND OLD.updated_at IS NOT NULL THEN
      v_days_in_from := GREATEST(0, EXTRACT(EPOCH FROM (now() - OLD.updated_at)) / 86400)::INTEGER;
    END IF;

    -- Derive pipeline_type from opportunity_type
    v_pipeline_type := CASE
      WHEN NEW.opportunity_type IN ('seller', 'landlord') THEN 'seller'
      WHEN NEW.opportunity_type IN ('referral_out', 'referral_in') THEN 'referral'
      ELSE 'buyer'
    END;

    INSERT INTO public.opportunity_stage_history (
      opportunity_id, agent_id, from_stage, to_stage,
      pipeline_type, days_in_from_stage, changed_by
    ) VALUES (
      NEW.id, NEW.agent_id, OLD.stage, NEW.stage,
      v_pipeline_type, v_days_in_from, 'agent'
    );

    -- Reset days_in_current_stage counter
    NEW.days_in_current_stage := 0;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_opportunity_stage_change ON public.opportunities;
CREATE TRIGGER trg_log_opportunity_stage_change
  BEFORE UPDATE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.log_opportunity_stage_change();

-- ── 5. Seed system-default playbooks ─────────────────────────────────────────

-- BUYER PIPELINE
INSERT INTO public.pipeline_stage_playbooks (pipeline_type, stage, task_type, title, due_days_offset, priority, sort_order) VALUES
-- new_lead
('buyer','new_lead','text',    'Send intro text within 24 hours',      1, 9, 1),
('buyer','new_lead','call',    'Schedule discovery call',              2, 8, 2),
('buyer','new_lead','follow_up','Add to SphereSync category',          1, 7, 3),
-- nurturing
('buyer','nurturing','follow_up','Set 30-day follow-up reminder',      1, 7, 1),
('buyer','nurturing','email',    'Add to newsletter list',             1, 6, 2),
('buyer','nurturing','follow_up','Log motivation and timeline notes',  1, 8, 3),
-- active_search
('buyer','active_search','call',    'Confirm pre-approval details',    1, 9, 1),
('buyer','active_search','follow_up','Set up MLS auto-search',         2, 8, 2),
('buyer','active_search','call',    'Review must-haves and deal-breakers', 3, 8, 3),
-- showing
('buyer','showing','meeting', 'Schedule first property showings',     1, 9, 1),
('buyer','showing','text',    'Text showing confirmation to client',  1, 8, 2),
('buyer','showing','call',    'Debrief after each showing',           2, 7, 3),
-- offer_submitted
('buyer','offer_submitted','text',    'Confirm offer submitted to client',    1, 10, 1),
('buyer','offer_submitted','follow_up','Set 24hr follow-up if no response',   1,  9, 2),
('buyer','offer_submitted','call',    'Discuss counter-offer strategy',       2,  8, 3),
-- under_contract
('buyer','under_contract','email',    'Send transaction timeline to client',  1, 10, 1),
('buyer','under_contract','meeting',  'Schedule inspection',                  2,  9, 2),
('buyer','under_contract','call',     'Introduce client to title company',    2,  9, 3),
('buyer','under_contract','follow_up','Order title / escrow',                 2,  8, 4),
-- closed_won
('buyer','closed_won','follow_up','Send closing gift',                1, 9, 1),
('buyer','closed_won','email',    'Request Google review',            2, 9, 2),
('buyer','closed_won','follow_up','Add to past-client drip campaign', 3, 8, 3),
('buyer','closed_won','follow_up','Log referral source in CRM',       1, 7, 4),

-- SELLER PIPELINE
('seller','new_lead','text',    'Send intro text within 24 hours',    1, 9, 1),
('seller','new_lead','call',    'Schedule listing consultation',      2, 8, 2),
-- nurturing
('seller','nurturing','email',  'Send market update for their area',  1, 7, 1),
('seller','nurturing','follow_up','Log motivation and timeline',      1, 8, 2),
-- pre_listing
('seller','pre_listing','follow_up','Complete CMA for listing price', 2, 10, 1),
('seller','pre_listing','follow_up','Pull tax records & HOA info',    3,  8, 2),
('seller','pre_listing','meeting',  'Schedule listing appointment',   3,  9, 3),
-- listing_appt
('seller','listing_appt','follow_up','Prepare listing presentation',  1, 10, 1),
('seller','listing_appt','call',    'Confirm appointment 24hrs prior',1,  9, 2),
('seller','listing_appt','follow_up','Print net proceeds sheet',      1,  8, 3),
-- listed_active
('seller','listed_active','follow_up','Submit to MLS',                1, 10, 1),
('seller','listed_active','meeting',  'Schedule professional photos', 1,  9, 2),
('seller','listed_active','email',    'Post listing to social media', 1,  8, 3),
('seller','listed_active','call',     'Weekly seller update call',    7,  7, 4),
-- offer_received
('seller','offer_received','call',     'Call seller with offer details',1, 10, 1),
('seller','offer_received','follow_up','Prepare counter-offer if needed',1, 9, 2),
('seller','offer_received','call',     'Review contingencies with client',2, 9, 3),
-- under_contract
('seller','under_contract','follow_up','Coordinate inspection access',  2, 10, 1),
('seller','under_contract','follow_up','Track contingency removal dates',3,  9, 2),
('seller','under_contract','call',     'Confirm buyer lender timeline', 3,  8, 3),
-- closed_won
('seller','closed_won','follow_up','Confirm wire/check received',     1, 10, 1),
('seller','closed_won','follow_up','Send thank-you gift',             2,  9, 2),
('seller','closed_won','email',    'Request video testimonial',       3,  9, 3),

-- REFERRAL PIPELINE
('referral','referral_received','call',    'Contact referral within 24 hours', 1, 10, 1),
('referral','referral_received','text',    'Text the referring agent — received', 1, 9, 2),
('referral','contacted','call',           'Qualify referral needs',           2,  9, 1),
('referral','active','follow_up',         'Update referring agent weekly',     7,  7, 1),
('referral','closed_won','email',         'Send referral fee to referring agent',2, 10, 1),
('referral','closed_won','text',          'Thank referring agent personally',  1,  9, 2)

ON CONFLICT DO NOTHING;
