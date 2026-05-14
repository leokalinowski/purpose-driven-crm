-- ============================================================================
-- Adopt Pam's flat 7-stage pipeline (per April 10, 2026 technical brief)
--
-- Replaces the buyer/seller/referral 3-set stage model with a single universal
-- list of 7 stages plus `lost` (terminal, off-board). The `opportunity_type`
-- column (buyer/seller/referral) is preserved as an independent card badge —
-- it no longer drives separate stage tracks.
--
-- The 8 valid stage values going forward:
--   1. conversation_active     — first chat, just entered the pipeline
--   2. opportunity_identified  — confirmed real buyer/seller intent
--   3. consultation_completed  — buyer consult / listing presentation done
--   4. client_secured          — buyer rep / listing agreement signed
--   5. active_opportunity      — buyer touring / listing live on market
--   6. under_contract          — offer accepted, in escrow
--   7. closed                  — transaction complete (terminal, won)
--   8. lost                    — dead lead / withdrew (terminal, off-board)
--
-- Plus NULL = contact is sphere-only (in `opportunities` but off the board).
-- Replaces the prior NOT NULL constraint on stage. Q2(c) decision: nurture-
-- only opportunities revert to sphere-only via NULL stage, preserving the
-- row's history (notes, dates, value) but removing it from the kanban.
--
-- Existing data migration (live DB at 2026-05-14):
--   • opportunities.stage  → remapped per OLD_TO_NEW below. Rows with
--                            stage='nurturing' → NULL (off-board).
--   • opportunity_stage_history.from_stage / .to_stage → remapped in place
--     per Q6(a). Nurturing in history maps to conversation_active so the
--     audit chronology stays meaningful.
--
-- Triggers are explicitly DISABLED on `opportunities` during the UPDATE so
-- that the rename doesn't generate spurious history rows / Coach-dirty
-- flags / priority rescores / updated_at churn. They're re-enabled before
-- COMMIT.
-- ============================================================================

BEGIN;

-- ─── 1. Trigger fix: skip log when moving to sphere-only (NEW.stage NULL) ──
-- This is independent of the migration itself — it's a permanent fix so
-- agents can move cards back to sphere-only without crashing the log
-- insert (to_stage on opportunity_stage_history is NOT NULL).
CREATE OR REPLACE FUNCTION public.log_opportunity_stage_change()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_days_in_from INTEGER := NULL;
  v_pipeline_type TEXT;
BEGIN
  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    IF NEW.stage IS NULL THEN
      RETURN NEW;
    END IF;
    IF OLD.stage IS NOT NULL AND OLD.updated_at IS NOT NULL THEN
      v_days_in_from := GREATEST(0, EXTRACT(EPOCH FROM (now() - OLD.updated_at)) / 86400)::INTEGER;
    END IF;
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
    NEW.days_in_current_stage := 0;
  END IF;
  RETURN NEW;
END;
$function$;

-- ─── 2. Allow NULL stage (sphere-only opportunity) ────────────────────────
ALTER TABLE public.opportunities ALTER COLUMN stage DROP NOT NULL;

-- ─── 3. Drop old CHECK so the UPDATEs aren't blocked ──────────────────────
ALTER TABLE public.opportunities DROP CONSTRAINT opportunities_stage_check;

-- ─── 4. Suppress side-effect triggers during the rename ───────────────────
-- This is a pure rename — we don't want the change to log history rows,
-- mark Coach state dirty, trigger a priority rescore, refresh the contact
-- pipeline_active cache, or bump updated_at. All user-defined triggers on
-- `opportunities` are disabled for the UPDATE and re-enabled immediately
-- after. (Internal/system triggers like FK constraints stay active.)
ALTER TABLE public.opportunities DISABLE TRIGGER USER;

UPDATE public.opportunities SET stage = CASE stage
  WHEN 'new_lead'           THEN 'conversation_active'
  WHEN 'referral_received'  THEN 'conversation_active'
  WHEN 'lead'               THEN 'conversation_active'
  WHEN 'nurturing'          THEN NULL
  WHEN 'contacted'          THEN 'opportunity_identified'
  WHEN 'qualified'          THEN 'opportunity_identified'
  WHEN 'pre_listing'        THEN 'consultation_completed'
  WHEN 'listing_appt'       THEN 'consultation_completed'
  WHEN 'appointment'        THEN 'consultation_completed'
  WHEN 'active_search'      THEN 'active_opportunity'
  WHEN 'showing'            THEN 'active_opportunity'
  WHEN 'listed_active'      THEN 'active_opportunity'
  WHEN 'active'             THEN 'active_opportunity'
  WHEN 'offer_submitted'    THEN 'under_contract'
  WHEN 'offer_received'     THEN 'under_contract'
  WHEN 'referral_sent'      THEN 'under_contract'
  WHEN 'contract'           THEN 'under_contract'
  WHEN 'under_contract'     THEN 'under_contract'
  WHEN 'closed_won'         THEN 'closed'
  WHEN 'closed'             THEN 'closed'
  WHEN 'lost'               THEN 'lost'
  ELSE stage
END;

ALTER TABLE public.opportunities ENABLE TRIGGER USER;

-- ─── 5. Remap history audit trail in place ────────────────────────────────
UPDATE public.opportunity_stage_history SET from_stage = CASE from_stage
  WHEN 'new_lead'           THEN 'conversation_active'
  WHEN 'referral_received'  THEN 'conversation_active'
  WHEN 'lead'               THEN 'conversation_active'
  WHEN 'nurturing'          THEN 'conversation_active'
  WHEN 'contacted'          THEN 'opportunity_identified'
  WHEN 'qualified'          THEN 'opportunity_identified'
  WHEN 'pre_listing'        THEN 'consultation_completed'
  WHEN 'listing_appt'       THEN 'consultation_completed'
  WHEN 'appointment'        THEN 'consultation_completed'
  WHEN 'active_search'      THEN 'active_opportunity'
  WHEN 'showing'            THEN 'active_opportunity'
  WHEN 'listed_active'      THEN 'active_opportunity'
  WHEN 'active'             THEN 'active_opportunity'
  WHEN 'offer_submitted'    THEN 'under_contract'
  WHEN 'offer_received'     THEN 'under_contract'
  WHEN 'referral_sent'      THEN 'under_contract'
  WHEN 'contract'           THEN 'under_contract'
  WHEN 'under_contract'     THEN 'under_contract'
  WHEN 'closed_won'         THEN 'closed'
  WHEN 'closed'             THEN 'closed'
  WHEN 'lost'               THEN 'lost'
  ELSE from_stage
END;

UPDATE public.opportunity_stage_history SET to_stage = CASE to_stage
  WHEN 'new_lead'           THEN 'conversation_active'
  WHEN 'referral_received'  THEN 'conversation_active'
  WHEN 'lead'               THEN 'conversation_active'
  WHEN 'nurturing'          THEN 'conversation_active'
  WHEN 'contacted'          THEN 'opportunity_identified'
  WHEN 'qualified'          THEN 'opportunity_identified'
  WHEN 'pre_listing'        THEN 'consultation_completed'
  WHEN 'listing_appt'       THEN 'consultation_completed'
  WHEN 'appointment'        THEN 'consultation_completed'
  WHEN 'active_search'      THEN 'active_opportunity'
  WHEN 'showing'            THEN 'active_opportunity'
  WHEN 'listed_active'      THEN 'active_opportunity'
  WHEN 'active'             THEN 'active_opportunity'
  WHEN 'offer_submitted'    THEN 'under_contract'
  WHEN 'offer_received'     THEN 'under_contract'
  WHEN 'referral_sent'      THEN 'under_contract'
  WHEN 'contract'           THEN 'under_contract'
  WHEN 'under_contract'     THEN 'under_contract'
  WHEN 'closed_won'         THEN 'closed'
  WHEN 'closed'             THEN 'closed'
  WHEN 'lost'               THEN 'lost'
  ELSE to_stage
END;

-- ─── 6. Add the new CHECK constraint (NULL allowed) ───────────────────────
ALTER TABLE public.opportunities
  ADD CONSTRAINT opportunities_stage_check
  CHECK (stage IS NULL OR stage = ANY (ARRAY[
    'conversation_active'::text,
    'opportunity_identified'::text,
    'consultation_completed'::text,
    'client_secured'::text,
    'active_opportunity'::text,
    'under_contract'::text,
    'closed'::text,
    'lost'::text
  ]));

COMMIT;
