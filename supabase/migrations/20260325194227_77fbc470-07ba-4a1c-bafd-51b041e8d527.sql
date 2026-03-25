-- Trigger function to auto-sync RSVPs to agent's contacts table
CREATE OR REPLACE FUNCTION public.sync_rsvp_to_contacts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_agent_id UUID;
  v_event_title TEXT;
  v_first_name TEXT;
  v_last_name TEXT;
  v_name_parts TEXT[];
BEGIN
  SELECT agent_id, title INTO v_agent_id, v_event_title
  FROM events
  WHERE id = NEW.event_id;

  IF v_agent_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.email IS NULL OR NEW.email = '' THEN
    RETURN NEW;
  END IF;

  v_name_parts := string_to_array(trim(NEW.name), ' ');
  IF array_length(v_name_parts, 1) >= 2 THEN
    v_first_name := v_name_parts[1];
    v_last_name := array_to_string(v_name_parts[2:], ' ');
  ELSE
    v_first_name := NULL;
    v_last_name := COALESCE(NEW.name, 'Unknown');
  END IF;

  INSERT INTO contacts (
    agent_id, first_name, last_name, email, phone, category, tags, notes
  )
  SELECT
    v_agent_id, v_first_name, v_last_name, lower(NEW.email), NEW.phone,
    upper(left(COALESCE(v_last_name, 'U'), 1)),
    ARRAY['Event RSVP', v_event_title],
    'Added via Event RSVP: ' || v_event_title
  WHERE NOT EXISTS (
    SELECT 1 FROM contacts
    WHERE agent_id = v_agent_id AND lower(email) = lower(NEW.email)
  );

  UPDATE contacts
  SET tags = array_cat(COALESCE(tags, ARRAY[]::text[]), ARRAY[v_event_title])
  WHERE agent_id = v_agent_id
  AND lower(email) = lower(NEW.email)
  AND NOT (COALESCE(tags, ARRAY[]::text[]) @> ARRAY[v_event_title]);

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'sync_rsvp_to_contacts failed for rsvp %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_rsvp_to_contacts ON event_rsvps;
CREATE TRIGGER trg_sync_rsvp_to_contacts
  AFTER INSERT ON event_rsvps
  FOR EACH ROW
  EXECUTE FUNCTION sync_rsvp_to_contacts();