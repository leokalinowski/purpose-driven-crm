-- ============================================================
-- Contacts: Relationship Intelligence Layer
-- Tier 1 (relationship moments) + Tier 2 (communication hygiene)
-- + Tier 3 (sphere intelligence). All columns nullable — zero
-- risk to existing rows.
-- ============================================================

-- ── Tier 1: Relationship Moments ──────────────────────────────────────────────
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS birthday          DATE,
  ADD COLUMN IF NOT EXISTS spouse_name       TEXT,
  ADD COLUMN IF NOT EXISTS spouse_birthday   DATE,
  ADD COLUMN IF NOT EXISTS home_anniversary  DATE,
  ADD COLUMN IF NOT EXISTS kids_count        SMALLINT,
  ADD COLUMN IF NOT EXISTS family_notes      TEXT;

-- ── Tier 2: Communication Hygiene ─────────────────────────────────────────────
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS preferred_contact_method TEXT,
  ADD COLUMN IF NOT EXISTS best_contact_time        TEXT,
  ADD COLUMN IF NOT EXISTS last_call_at             TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_text_at             TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_email_at            TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contacts_preferred_contact_method_chk'
  ) THEN
    ALTER TABLE public.contacts
      ADD CONSTRAINT contacts_preferred_contact_method_chk
      CHECK (preferred_contact_method IS NULL
             OR preferred_contact_method IN ('call','text','email','dm'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contacts_best_contact_time_chk'
  ) THEN
    ALTER TABLE public.contacts
      ADD CONSTRAINT contacts_best_contact_time_chk
      CHECK (best_contact_time IS NULL
             OR best_contact_time IN ('morning','lunch','evening','weekend','anytime'));
  END IF;
END $$;

-- ── Tier 3: Sphere Intelligence ───────────────────────────────────────────────
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS met_through       TEXT,
  ADD COLUMN IF NOT EXISTS met_through_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS social_instagram  TEXT,
  ADD COLUMN IF NOT EXISTS social_linkedin   TEXT,
  ADD COLUMN IF NOT EXISTS social_facebook   TEXT,
  ADD COLUMN IF NOT EXISTS engagement_trend  TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contacts_engagement_trend_chk'
  ) THEN
    ALTER TABLE public.contacts
      ADD CONSTRAINT contacts_engagement_trend_chk
      CHECK (engagement_trend IS NULL
             OR engagement_trend IN ('warming','stable','cooling','dormant'));
  END IF;
END $$;

-- ── Indexes ───────────────────────────────────────────────────────────────────
-- Birthday/anniversary scans for upcoming-moment dashboards (month-of-year).
CREATE INDEX IF NOT EXISTS idx_contacts_birthday_month
  ON public.contacts (agent_id, (EXTRACT(MONTH FROM birthday)))
  WHERE birthday IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_home_anniversary_month
  ON public.contacts (agent_id, (EXTRACT(MONTH FROM home_anniversary)))
  WHERE home_anniversary IS NOT NULL;

-- Engagement trend filter for cadence + AI prioritization.
CREATE INDEX IF NOT EXISTS idx_contacts_engagement_trend
  ON public.contacts (agent_id, engagement_trend)
  WHERE engagement_trend IS NOT NULL;

-- Referral graph traversal.
CREATE INDEX IF NOT EXISTS idx_contacts_met_through_contact_id
  ON public.contacts (met_through_contact_id)
  WHERE met_through_contact_id IS NOT NULL;

-- ── Trigger: maintain channel-split last_*_at from contact_activities ─────────
CREATE OR REPLACE FUNCTION public.refresh_contact_channel_last_touch()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_contact_id UUID;
  v_type       TEXT;
  v_when       TIMESTAMPTZ;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_contact_id := OLD.contact_id;
    v_type       := OLD.activity_type;
  ELSE
    v_contact_id := NEW.contact_id;
    v_type       := NEW.activity_type;
    v_when       := COALESCE(NEW.activity_date, now());
  END IF;

  IF v_contact_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    -- On delete, recompute the max for the affected channel.
    IF v_type = 'call' THEN
      UPDATE public.contacts
         SET last_call_at = (SELECT MAX(activity_date) FROM public.contact_activities
                              WHERE contact_id = v_contact_id AND activity_type = 'call')
       WHERE id = v_contact_id;
    ELSIF v_type = 'text' THEN
      UPDATE public.contacts
         SET last_text_at = (SELECT MAX(activity_date) FROM public.contact_activities
                              WHERE contact_id = v_contact_id AND activity_type = 'text')
       WHERE id = v_contact_id;
    ELSIF v_type = 'email' THEN
      UPDATE public.contacts
         SET last_email_at = (SELECT MAX(activity_date) FROM public.contact_activities
                               WHERE contact_id = v_contact_id AND activity_type = 'email')
       WHERE id = v_contact_id;
    END IF;
    RETURN OLD;
  END IF;

  -- Insert/update: only bump if newer.
  IF v_type = 'call' THEN
    UPDATE public.contacts
       SET last_call_at = GREATEST(COALESCE(last_call_at, '-infinity'::timestamptz), v_when)
     WHERE id = v_contact_id;
  ELSIF v_type = 'text' THEN
    UPDATE public.contacts
       SET last_text_at = GREATEST(COALESCE(last_text_at, '-infinity'::timestamptz), v_when)
     WHERE id = v_contact_id;
  ELSIF v_type = 'email' THEN
    UPDATE public.contacts
       SET last_email_at = GREATEST(COALESCE(last_email_at, '-infinity'::timestamptz), v_when)
     WHERE id = v_contact_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_contact_channel_last_touch ON public.contact_activities;
CREATE TRIGGER trg_refresh_contact_channel_last_touch
  AFTER INSERT OR UPDATE OR DELETE ON public.contact_activities
  FOR EACH ROW EXECUTE FUNCTION public.refresh_contact_channel_last_touch();

-- ── Backfill channel-split last-touch from existing activities ────────────────
UPDATE public.contacts c
   SET last_call_at = sub.last_call,
       last_text_at = sub.last_text,
       last_email_at = sub.last_email
  FROM (
    SELECT contact_id,
           MAX(activity_date) FILTER (WHERE activity_type = 'call')  AS last_call,
           MAX(activity_date) FILTER (WHERE activity_type = 'text')  AS last_text,
           MAX(activity_date) FILTER (WHERE activity_type = 'email') AS last_email
      FROM public.contact_activities
     GROUP BY contact_id
  ) sub
 WHERE c.id = sub.contact_id;

-- ── Comments (documentation in catalog) ───────────────────────────────────────
COMMENT ON COLUMN public.contacts.birthday          IS 'Contact birthday (month/day used for annual reach-outs).';
COMMENT ON COLUMN public.contacts.home_anniversary  IS 'Closing date if agent represented this contact; powers yearly equity check-ins.';
COMMENT ON COLUMN public.contacts.preferred_contact_method IS 'One of: call, text, email, dm.';
COMMENT ON COLUMN public.contacts.best_contact_time IS 'One of: morning, lunch, evening, weekend, anytime.';
COMMENT ON COLUMN public.contacts.last_call_at      IS 'Auto-maintained via contact_activities trigger.';
COMMENT ON COLUMN public.contacts.last_text_at      IS 'Auto-maintained via contact_activities trigger.';
COMMENT ON COLUMN public.contacts.last_email_at     IS 'Auto-maintained via contact_activities trigger.';
COMMENT ON COLUMN public.contacts.met_through       IS 'Free-text "met at Sarah''s housewarming" — used when no contact_id link is known.';
COMMENT ON COLUMN public.contacts.met_through_contact_id IS 'FK referral graph link (preferred over met_through text when available).';
COMMENT ON COLUMN public.contacts.engagement_trend  IS 'One of: warming, stable, cooling, dormant. Computed weekly by edge function.';
