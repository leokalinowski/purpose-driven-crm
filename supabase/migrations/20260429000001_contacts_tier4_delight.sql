-- ============================================================
-- Contacts: Tier 4 — Surprise & Delight
-- Adds gift tracking fields + extends contact_activities.activity_type
-- to include 'gift' so /delight can log + summarize sent gifts.
-- ============================================================

-- ── Tier 4: Investment + Gift Tracking ────────────────────────────────────────
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS owns_investment_properties BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS current_home_purchase_price NUMERIC,
  ADD COLUMN IF NOT EXISTS current_home_purchase_date  DATE,
  ADD COLUMN IF NOT EXISTS last_gift_sent_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS gift_preferences            TEXT;

COMMENT ON COLUMN public.contacts.owns_investment_properties IS 'Heuristic flag for investor outreach + market data segmentation.';
COMMENT ON COLUMN public.contacts.current_home_purchase_price IS 'Last known purchase price; used in equity check-in nudges.';
COMMENT ON COLUMN public.contacts.current_home_purchase_date  IS 'Last known purchase date; mirrors home_anniversary for clarity.';
COMMENT ON COLUMN public.contacts.last_gift_sent_at IS 'Auto-maintained via contact_activities trigger when activity_type = gift.';
COMMENT ON COLUMN public.contacts.gift_preferences  IS 'Free-text — wine, sweets, no alcohol, dog person, etc.';

-- ── Extend activity_type CHECK to allow gift logging ──────────────────────────
DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  SELECT conname INTO v_constraint_name
    FROM pg_constraint
   WHERE conrelid = 'public.contact_activities'::regclass
     AND contype  = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%activity_type%';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.contact_activities DROP CONSTRAINT %I', v_constraint_name);
  END IF;

  ALTER TABLE public.contact_activities
    ADD CONSTRAINT contact_activities_activity_type_chk
    CHECK (activity_type IN ('call','text','email','meeting','note','task','gift'));
END $$;

-- ── Extend the channel-last-touch trigger so 'gift' updates last_gift_sent_at ─
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
    ELSIF v_type = 'gift' THEN
      UPDATE public.contacts
         SET last_gift_sent_at = (SELECT MAX(activity_date) FROM public.contact_activities
                                   WHERE contact_id = v_contact_id AND activity_type = 'gift')
       WHERE id = v_contact_id;
    END IF;
    RETURN OLD;
  END IF;

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
  ELSIF v_type = 'gift' THEN
    UPDATE public.contacts
       SET last_gift_sent_at = GREATEST(COALESCE(last_gift_sent_at, '-infinity'::timestamptz), v_when)
     WHERE id = v_contact_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger already exists from 2026-04-28 migration; re-create to be safe.
DROP TRIGGER IF EXISTS trg_refresh_contact_channel_last_touch ON public.contact_activities;
CREATE TRIGGER trg_refresh_contact_channel_last_touch
  AFTER INSERT OR UPDATE OR DELETE ON public.contact_activities
  FOR EACH ROW EXECUTE FUNCTION public.refresh_contact_channel_last_touch();

-- ── Backfill last_gift_sent_at from any existing gift activities ──────────────
UPDATE public.contacts c
   SET last_gift_sent_at = sub.last_gift
  FROM (
    SELECT contact_id, MAX(activity_date) AS last_gift
      FROM public.contact_activities
     WHERE activity_type = 'gift'
     GROUP BY contact_id
  ) sub
 WHERE c.id = sub.contact_id;

-- ── Index: surface contacts with no gift this year for nudge queries ──────────
CREATE INDEX IF NOT EXISTS idx_contacts_last_gift_sent_at
  ON public.contacts (agent_id, last_gift_sent_at)
  WHERE last_gift_sent_at IS NOT NULL;
