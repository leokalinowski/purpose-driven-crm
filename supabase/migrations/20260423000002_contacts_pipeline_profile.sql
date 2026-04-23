-- ============================================================
-- Migration A: Rich Contact Pipeline Profile
-- All columns are nullable — zero risk to existing rows.
-- ============================================================

-- ── Buyer Profile ─────────────────────────────────────────────────────────────
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS buyer_price_min           NUMERIC(12,0),
  ADD COLUMN IF NOT EXISTS buyer_price_max           NUMERIC(12,0),
  ADD COLUMN IF NOT EXISTS buyer_bedrooms_min        SMALLINT,
  ADD COLUMN IF NOT EXISTS buyer_bathrooms_min       NUMERIC(3,1),
  ADD COLUMN IF NOT EXISTS buyer_property_type       TEXT,
  ADD COLUMN IF NOT EXISTS buyer_target_cities       TEXT[],
  ADD COLUMN IF NOT EXISTS buyer_target_zip_codes    TEXT[],
  ADD COLUMN IF NOT EXISTS buyer_must_haves          TEXT,
  ADD COLUMN IF NOT EXISTS buyer_deal_breakers       TEXT,
  ADD COLUMN IF NOT EXISTS buyer_pre_approval_status TEXT DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS buyer_pre_approval_amount NUMERIC(12,0),
  ADD COLUMN IF NOT EXISTS buyer_pre_approval_expiry DATE,
  ADD COLUMN IF NOT EXISTS buyer_lender_name         TEXT,
  ADD COLUMN IF NOT EXISTS buyer_loan_type           TEXT;

-- ── Seller Profile ────────────────────────────────────────────────────────────
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS seller_property_address TEXT,
  ADD COLUMN IF NOT EXISTS seller_property_city    TEXT,
  ADD COLUMN IF NOT EXISTS seller_property_state   TEXT,
  ADD COLUMN IF NOT EXISTS seller_property_zip     TEXT,
  ADD COLUMN IF NOT EXISTS seller_property_type    TEXT,
  ADD COLUMN IF NOT EXISTS seller_estimated_value  NUMERIC(12,0),
  ADD COLUMN IF NOT EXISTS seller_mortgage_balance NUMERIC(12,0),
  ADD COLUMN IF NOT EXISTS seller_equity_estimate  NUMERIC(12,0),
  ADD COLUMN IF NOT EXISTS seller_home_condition   TEXT,
  ADD COLUMN IF NOT EXISTS seller_listing_timeline TEXT,
  ADD COLUMN IF NOT EXISTS seller_motivation_reason TEXT,
  ADD COLUMN IF NOT EXISTS seller_has_agent        BOOLEAN,
  ADD COLUMN IF NOT EXISTS seller_interview_date   DATE;

-- ── Relationship Signals ──────────────────────────────────────────────────────
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS contact_type               TEXT DEFAULT 'contact',
  ADD COLUMN IF NOT EXISTS relationship_strength      SMALLINT,
  ADD COLUMN IF NOT EXISTS sphere_influence_score     SMALLINT,
  ADD COLUMN IF NOT EXISTS pipeline_active            BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pipeline_stage_summary     TEXT,
  ADD COLUMN IF NOT EXISTS last_pipeline_activity     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS referral_source            TEXT,
  ADD COLUMN IF NOT EXISTS referral_source_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referred_contacts_count    INTEGER DEFAULT 0;

-- ── Motivation & Timeline ─────────────────────────────────────────────────────
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS motivation_score  SMALLINT,
  ADD COLUMN IF NOT EXISTS motivation_notes  TEXT,
  ADD COLUMN IF NOT EXISTS move_timeline     TEXT,
  ADD COLUMN IF NOT EXISTS life_event        TEXT,
  ADD COLUMN IF NOT EXISTS life_event_date   DATE;

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_contacts_pipeline_active
  ON public.contacts(agent_id, pipeline_active)
  WHERE pipeline_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_contacts_contact_type
  ON public.contacts(agent_id, contact_type);

CREATE INDEX IF NOT EXISTS idx_contacts_move_timeline
  ON public.contacts(agent_id, move_timeline);

-- ── Trigger: keep pipeline_active + pipeline_stage_summary current ────────────
CREATE OR REPLACE FUNCTION public.refresh_contact_pipeline_active()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_contact_id UUID;
  v_open_opp   RECORD;
BEGIN
  -- Determine which contact_id changed
  IF TG_OP = 'DELETE' THEN
    v_contact_id := OLD.contact_id;
  ELSE
    v_contact_id := NEW.contact_id;
  END IF;

  -- Find the most recent open opportunity for this contact
  SELECT stage, opportunity_type
    INTO v_open_opp
    FROM public.opportunities
   WHERE contact_id = v_contact_id
     AND actual_close_date IS NULL
     AND (outcome IS NULL OR outcome NOT IN ('lost','withdrawn'))
   ORDER BY updated_at DESC
   LIMIT 1;

  IF FOUND THEN
    UPDATE public.contacts
       SET pipeline_active        = TRUE,
           pipeline_stage_summary = initcap(replace(v_open_opp.opportunity_type, '_', ' '))
                                    || ' — '
                                    || initcap(replace(v_open_opp.stage, '_', ' ')),
           last_pipeline_activity = now()
     WHERE id = v_contact_id;
  ELSE
    UPDATE public.contacts
       SET pipeline_active        = FALSE,
           pipeline_stage_summary = NULL
     WHERE id = v_contact_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_contact_pipeline_active ON public.opportunities;
CREATE TRIGGER trg_refresh_contact_pipeline_active
  AFTER INSERT OR UPDATE OR DELETE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.refresh_contact_pipeline_active();
