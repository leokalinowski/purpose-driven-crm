-- Pipeline UX audit follow-up: production rows from August 2025 still carry
-- pre-meta-stage values ('lead', 'closed') that the current STAGE_TO_META
-- mapping in src/config/pipelineStages.ts doesn't recognize. Those rows are
-- silently filtered out of the kanban board (PipelineBoard.tsx:31-32 only
-- shows rows with a non-null meta-stage). Agents have no way to see these
-- opportunities, even though they're real deals.
--
-- This one-time data fix remaps the legacy values to their semantic
-- equivalents in the current schema. Logged via opportunity_stage_history so
-- the change is auditable.

-- 1) 'lead' → 'new_lead' (lands in the Leads meta-stage column)
WITH legacy_leads AS (
  SELECT id, agent_id, stage AS old_stage, opportunity_type
    FROM public.opportunities
   WHERE stage = 'lead'
)
INSERT INTO public.opportunity_stage_history (
  opportunity_id, agent_id, from_stage, to_stage, pipeline_type,
  days_in_from_stage, changed_by, notes
)
SELECT id, agent_id, old_stage, 'new_lead',
       CASE WHEN opportunity_type IN ('seller', 'landlord') THEN 'seller'
            WHEN opportunity_type IN ('referral_out', 'referral_in') THEN 'referral'
            ELSE 'buyer' END,
       NULL, 'system-migration',
       'Legacy stage `lead` remapped to `new_lead` so the row appears in the Leads meta-stage column on the Pipeline board.'
  FROM legacy_leads;

UPDATE public.opportunities
   SET stage = 'new_lead'
 WHERE stage = 'lead';

-- 2) 'closed' → 'closed_won' if outcome IS NULL (landing in Closed); else 'lost'
WITH legacy_closed AS (
  SELECT id, agent_id, stage AS old_stage, outcome, opportunity_type
    FROM public.opportunities
   WHERE stage = 'closed'
)
INSERT INTO public.opportunity_stage_history (
  opportunity_id, agent_id, from_stage, to_stage, pipeline_type,
  days_in_from_stage, changed_by, notes
)
SELECT id, agent_id, old_stage,
       CASE WHEN outcome IS NULL OR outcome = 'won' THEN 'closed_won' ELSE 'lost' END,
       CASE WHEN opportunity_type IN ('seller', 'landlord') THEN 'seller'
            WHEN opportunity_type IN ('referral_out', 'referral_in') THEN 'referral'
            ELSE 'buyer' END,
       NULL, 'system-migration',
       'Legacy stage `closed` remapped — `closed_won` if no outcome, else `lost` — so the row appears in a meta-stage column.'
  FROM legacy_closed;

UPDATE public.opportunities
   SET stage = CASE
                 WHEN outcome IS NULL OR outcome = 'won' THEN 'closed_won'
                 ELSE 'lost'
               END
 WHERE stage = 'closed';

-- 3) Other unused legacy values in the CHECK constraint ('qualified',
-- 'appointment', 'contract') currently have zero rows in production. Once
-- this migration confirms the table is clean, a follow-up migration can
-- tighten the CHECK constraint to drop them. Keep flexible for now.
