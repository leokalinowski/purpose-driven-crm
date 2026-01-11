-- Fix SECURITY DEFINER function: add SET search_path = '' for security
CREATE OR REPLACE FUNCTION public.update_event_rsvp_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the count of confirmed RSVPs
  UPDATE public.events
  SET current_rsvp_count = (
    SELECT COUNT(*)::INTEGER
    FROM public.event_rsvps
    WHERE event_id = COALESCE(NEW.event_id, OLD.event_id)
    AND status = 'confirmed'
  )
  WHERE id = COALESCE(NEW.event_id, OLD.event_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = '';