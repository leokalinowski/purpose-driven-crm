-- ============================================================
-- event_rsvps: drop orphan public INSERT policy + harden the RPC
--
-- Audit finding (2026-05-18): the `Public can create RSVPs` policy
-- on event_rsvps lets ANY anonymous caller INSERT a row directly via
-- PostgREST as long as the target event is_published=true. A scraper
-- can enumerate every published event slug and pollute event_rsvps
-- with fake names/emails/phones — and because (event_id, email) is
-- unique, an attacker can block legitimate signups by claiming a
-- victim's email first.
--
-- The frontend stopped using direct PostgREST INSERT long ago in
-- favor of the SECURITY DEFINER `submit_public_rsvp` RPC (see
-- src/hooks/useRSVP.ts:43). The policy is vestigial — drop it.
--
-- Then harden the RPC itself with three new gates:
--   1. Email format validation (cheap regex).
--   2. Length caps on user input (defense against blob-stuffing).
--   3. Per-event 5-minute throttle: max 30 RSVPs in a rolling
--      5-minute window. A real event burst rarely exceeds 10-15;
--      30 leaves headroom for genuinely popular events while
--      cutting an enumeration attack off at the knees.
--
-- This doesn't replace true per-IP rate limiting (which on Supabase
-- requires moving the insert into an edge function with a Redis-like
-- store). It's the largest exposure-reducing change that doesn't
-- require an architecture rewrite.
-- ============================================================

-- ── 1. Drop the orphan public INSERT policy ──
DROP POLICY IF EXISTS "Public can create RSVPs" ON public.event_rsvps;

-- ── 2. Re-create the RPC with validation + throttle ──
CREATE OR REPLACE FUNCTION public.submit_public_rsvp(
  p_event_id uuid,
  p_email text,
  p_name text,
  p_phone text DEFAULT NULL,
  p_guest_count integer DEFAULT 1
)
RETURNS TABLE(id uuid, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_max_capacity INTEGER;
  v_current_count INTEGER;
  v_is_published BOOLEAN;
  v_new_id UUID;
  v_status TEXT;
  v_recent_count INTEGER;
BEGIN
  -- ── Validation: email format ──
  -- Rough but effective. We're not trying to RFC-5322; just blocking
  -- obvious junk before it lands in the table.
  IF p_email IS NULL OR p_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'Invalid email format';
  END IF;

  -- ── Validation: input length caps ──
  -- Blob-stuffing defense: nothing in the form should ever exceed
  -- these. If someone submits a 50KB name field they're either
  -- attacking us or filling out a different form by accident.
  IF length(p_email) > 250
     OR length(p_name) > 200
     OR length(coalesce(p_phone, '')) > 50
     OR p_guest_count < 1
     OR p_guest_count > 20
  THEN
    RAISE EXCEPTION 'Input exceeds allowed range';
  END IF;

  -- ── Verify event exists and is published ──
  SELECT e.max_capacity, e.current_rsvp_count, e.is_published
  INTO v_max_capacity, v_current_count, v_is_published
  FROM events e
  WHERE e.id = p_event_id;

  IF NOT FOUND OR v_is_published IS NOT TRUE THEN
    RAISE EXCEPTION 'Event not found or not published';
  END IF;

  -- ── Throttle: per-event 5-minute rolling window ──
  -- 30 RSVPs in 5 minutes is the upper bound of a normal burst.
  -- An enumeration script trying to fill a victim event hits this
  -- after the first wave and gets locked out for the rest of the
  -- window; subsequent attempts fail-loud with the same error.
  SELECT count(*)
  INTO v_recent_count
  FROM event_rsvps er
  WHERE er.event_id = p_event_id
    AND er.created_at > NOW() - INTERVAL '5 minutes';

  IF v_recent_count >= 30 THEN
    RAISE EXCEPTION 'Too many RSVPs received for this event in the last few minutes. Please try again shortly.';
  END IF;

  -- ── Duplicate check ──
  IF EXISTS (
    SELECT 1 FROM event_rsvps er
    WHERE er.event_id = p_event_id
      AND lower(er.email) = lower(p_email)
  ) THEN
    RAISE EXCEPTION 'You have already RSVPed for this event';
  END IF;

  -- ── Determine status (capacity vs waitlist) ──
  IF v_max_capacity IS NOT NULL AND v_current_count >= v_max_capacity THEN
    v_status := 'waitlist';
  ELSE
    v_status := 'confirmed';
  END IF;

  -- ── Insert ──
  INSERT INTO event_rsvps (event_id, email, name, phone, guest_count, status)
  VALUES (p_event_id, lower(p_email), p_name, p_phone, p_guest_count, v_status)
  RETURNING event_rsvps.id INTO v_new_id;

  id := v_new_id;
  status := v_status;
  RETURN NEXT;
END;
$function$;

COMMENT ON FUNCTION public.submit_public_rsvp(uuid, text, text, text, integer) IS
  'Public RSVP submission with email validation, length caps, and a per-event 5-min throttle (max 30 RSVPs/5min). Hardened 2026-05-18.';
