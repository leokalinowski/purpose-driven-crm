-- Create secure RPC function for duplicate RSVP checking
-- This replaces direct SELECT access to event_rsvps for public users
CREATE OR REPLACE FUNCTION check_duplicate_rsvp(p_event_id UUID, p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify event is published
  IF NOT EXISTS(SELECT 1 FROM events WHERE id = p_event_id AND is_published = true) THEN
    RETURN false;
  END IF;
  
  -- Check for duplicate - return true if already RSVPed
  RETURN EXISTS(
    SELECT 1 FROM event_rsvps
    WHERE event_id = p_event_id 
    AND lower(email) = lower(p_email)
    AND status = 'confirmed'
  );
END;
$$;

-- Also create a function to get RSVP status by email (for cancellation flow)
-- Only returns the user's own RSVP info, verified by email match
CREATE OR REPLACE FUNCTION get_own_rsvp(p_event_id UUID, p_email TEXT)
RETURNS TABLE(
  id UUID,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify event is published
  IF NOT EXISTS(SELECT 1 FROM events WHERE id = p_event_id AND is_published = true) THEN
    RETURN;
  END IF;
  
  -- Return only the RSVP for this specific email
  RETURN QUERY
  SELECT er.id, er.status::TEXT
  FROM event_rsvps er
  WHERE er.event_id = p_event_id 
  AND lower(er.email) = lower(p_email);
END;
$$;

-- Drop the vulnerable public SELECT policy
DROP POLICY IF EXISTS "Public can view RSVPs for published events" ON event_rsvps;