-- ============================================================
-- contacts.priority_band: tighten CHECK to (pipeline, cadence)
--
-- Audit finding (2026-05-18): the constraint still allows
-- 'engagement' and 'sphere' from the pre-set-based-v7 model
-- (PRs #31/#32), even though `compute-priority-scores` v11 only
-- writes 'pipeline' | 'cadence' | NULL. Schema-vs-code drift —
-- if a future scorer bug writes one of the stale values, it
-- slips through and breaks the UI sort/filter.
--
-- Live data confirmed clean:
--   priority_band  count
--   pipeline        5
--   cadence       266
--   NULL         3109
--   (no engagement / sphere rows)
--
-- Drop the old check + recreate with the tight allowlist.
-- ============================================================

ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS contacts_priority_band_check;

ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_priority_band_check
  CHECK (priority_band IS NULL OR priority_band = ANY (ARRAY['pipeline'::text, 'cadence'::text]));

COMMENT ON CONSTRAINT contacts_priority_band_check ON public.contacts IS
  'Tightened 2026-05-18 to match set-based-v7 scorer output. Allowed: NULL, pipeline, cadence. The pre-v7 engagement/sphere values are no longer written and were never present in live data at the time of tightening.';
