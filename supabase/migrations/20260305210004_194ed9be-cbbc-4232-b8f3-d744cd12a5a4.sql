
CREATE OR REPLACE FUNCTION public.submit_public_rsvp(
  p_event_id UUID,
  p_email TEXT,
  p_name TEXT,
  p_phone TEXT DEFAULT NULL,
  p_guest_count INTEGER DEFAULT 1
)
RETURNS TABLE(id UUID, status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_max_capacity INTEGER;
  v_current_count INTEGER;
  v_is_published BOOLEAN;
  v_new_id UUID;
  v_status TEXT;
BEGIN
  -- Verify event exists and is published
  SELECT e.max_capacity, e.current_rsvp_count, e.is_published
  INTO v_max_capacity, v_current_count, v_is_published
  FROM events e
  WHERE e.id = p_event_id;

  IF NOT FOUND OR v_is_published IS NOT TRUE THEN
    RAISE EXCEPTION 'Event not found or not published';
  END IF;

  -- Check for duplicate RSVP (any status)
  IF EXISTS (
    SELECT 1 FROM event_rsvps er
    WHERE er.event_id = p_event_id
    AND lower(er.email) = lower(p_email)
  ) THEN
    RAISE EXCEPTION 'You have already RSVPed for this event';
  END IF;

  -- Determine status based on capacity
  IF v_max_capacity IS NOT NULL AND v_current_count >= v_max_capacity THEN
    v_status := 'waitlist';
  ELSE
    v_status := 'confirmed';
  END IF;

  -- Insert the RSVP
  INSERT INTO event_rsvps (event_id, email, name, phone, guest_count, status)
  VALUES (p_event_id, lower(p_email), p_name, p_phone, p_guest_count, v_status)
  RETURNING event_rsvps.id INTO v_new_id;

  -- Return result
  id := v_new_id;
  status := v_status;
  RETURN NEXT;
END;
$$;
