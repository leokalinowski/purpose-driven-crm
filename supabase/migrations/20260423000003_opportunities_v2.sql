-- ============================================================
-- Migration B: Enhanced Opportunities Table (v2)
-- All new columns are nullable / have safe defaults.
-- Existing rows get opportunity_type = 'buyer' automatically.
-- ============================================================

-- ── Classification ────────────────────────────────────────────────────────────
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS opportunity_type TEXT NOT NULL DEFAULT 'buyer',
  ADD COLUMN IF NOT EXISTS title            TEXT;

-- pipeline_type: generated column that drives which stage set to display
-- (requires Postgres 12+, available on all Supabase projects)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'opportunities'
       AND column_name  = 'pipeline_type'
  ) THEN
    ALTER TABLE public.opportunities
      ADD COLUMN pipeline_type TEXT GENERATED ALWAYS AS (
        CASE
          WHEN opportunity_type IN ('seller', 'landlord') THEN 'seller'
          WHEN opportunity_type IN ('referral_out', 'referral_in') THEN 'referral'
          ELSE 'buyer'
        END
      ) STORED;
  END IF;
END;
$$;

-- ── Property Details ─────────────────────────────────────────────────────────
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS property_address   TEXT,
  ADD COLUMN IF NOT EXISTS property_city      TEXT,
  ADD COLUMN IF NOT EXISTS property_state     TEXT,
  ADD COLUMN IF NOT EXISTS property_zip       TEXT,
  ADD COLUMN IF NOT EXISTS property_type      TEXT,
  ADD COLUMN IF NOT EXISTS property_beds      SMALLINT,
  ADD COLUMN IF NOT EXISTS property_baths     NUMERIC(3,1),
  ADD COLUMN IF NOT EXISTS property_sqft      INTEGER,
  ADD COLUMN IF NOT EXISTS property_year_built SMALLINT,
  ADD COLUMN IF NOT EXISTS property_mls_number TEXT,
  ADD COLUMN IF NOT EXISTS property_url       TEXT;

-- ── Financial ────────────────────────────────────────────────────────────────
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS list_price         NUMERIC(12,0),
  ADD COLUMN IF NOT EXISTS offer_price        NUMERIC(12,0),
  ADD COLUMN IF NOT EXISTS sale_price         NUMERIC(12,0),
  ADD COLUMN IF NOT EXISTS commission_pct     NUMERIC(5,3),
  ADD COLUMN IF NOT EXISTS commission_amount  NUMERIC(12,0),
  ADD COLUMN IF NOT EXISTS gci_estimated      NUMERIC(12,0),
  ADD COLUMN IF NOT EXISTS gci_actual         NUMERIC(12,0),
  ADD COLUMN IF NOT EXISTS referral_fee_pct   NUMERIC(5,3),
  ADD COLUMN IF NOT EXISTS referral_agent_name TEXT,
  ADD COLUMN IF NOT EXISTS referral_brokerage TEXT;

-- ── Timeline ─────────────────────────────────────────────────────────────────
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS first_contact_date          DATE,
  ADD COLUMN IF NOT EXISTS target_move_date            DATE,
  ADD COLUMN IF NOT EXISTS listing_appointment_date    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS offer_date                  DATE,
  ADD COLUMN IF NOT EXISTS contract_date               DATE,
  ADD COLUMN IF NOT EXISTS inspection_date             DATE,
  ADD COLUMN IF NOT EXISTS appraisal_date              DATE,
  ADD COLUMN IF NOT EXISTS loan_contingency_removal    DATE,
  ADD COLUMN IF NOT EXISTS closing_date_scheduled      DATE;

-- ── AI Fields ────────────────────────────────────────────────────────────────
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS ai_deal_probability      SMALLINT,
  ADD COLUMN IF NOT EXISTS ai_summary               TEXT,
  ADD COLUMN IF NOT EXISTS ai_suggested_next_action TEXT,
  ADD COLUMN IF NOT EXISTS ai_risk_flags            TEXT[],
  ADD COLUMN IF NOT EXISTS ai_scored_at             TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_stale                 BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS stale_since              DATE,
  ADD COLUMN IF NOT EXISTS days_in_current_stage    INTEGER DEFAULT 0;

-- ── Status / Outcome ─────────────────────────────────────────────────────────
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS outcome            TEXT,
  ADD COLUMN IF NOT EXISTS lost_reason        TEXT,
  ADD COLUMN IF NOT EXISTS lost_reason_notes  TEXT,
  ADD COLUMN IF NOT EXISTS on_hold_until      DATE,
  ADD COLUMN IF NOT EXISTS priority           SMALLINT DEFAULT 5;

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_opportunities_type_outcome
  ON public.opportunities(agent_id, opportunity_type, outcome);

CREATE INDEX IF NOT EXISTS idx_opportunities_stale
  ON public.opportunities(agent_id, is_stale)
  WHERE is_stale = TRUE;

CREATE INDEX IF NOT EXISTS idx_opportunities_ai_scored
  ON public.opportunities(agent_id, ai_scored_at DESC NULLS LAST);

-- ── Trigger: log stage changes + reset days_in_current_stage ─────────────────
-- (stage_history table created in Migration C; trigger added there)
