-- ============================================================
-- profiles: track Terms and Conditions acceptance per user
--
-- Adds two columns the frontend reads to decide whether to prompt
-- a user with the T&C acceptance modal:
--
--   terms_version       text          The version string the user
--                                     accepted (matches the constant
--                                     in src/content/legal/index.ts).
--                                     NULL = has never accepted.
--
--   terms_accepted_at   timestamptz   When acceptance happened.
--                                     NULL = has never accepted.
--
-- The gate logic in the frontend:
--   - NULL terms_version          → prompt
--   - terms_version != current    → prompt (T&C bumped, re-consent)
--   - terms_version == current    → no prompt
--
-- The current value lives in src/content/legal/index.ts as
-- `TERMS_VERSION` (YYYY-MM-DD format matching the "Last Updated"
-- line in terms.md). Bump both in lockstep whenever the legal text
-- changes materially.
--
-- Why two columns and not one? `terms_accepted_at` is the audit-
-- trail timestamp; if/when we need to prove "user X accepted v1.2
-- on YYYY-MM-DD at HH:MM:SS" — for a dispute, a regulator, or a
-- support case — the timestamp is the legal record. Version alone
-- can't answer "when."
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_version     text,
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;

COMMENT ON COLUMN public.profiles.terms_version IS
  'Version string of the T&C the user accepted. Matches TERMS_VERSION constant in src/content/legal/index.ts (YYYY-MM-DD). NULL = never accepted.';

COMMENT ON COLUMN public.profiles.terms_accepted_at IS
  'Timestamp the user accepted the recorded terms_version. Audit trail for legal/regulatory questions.';
