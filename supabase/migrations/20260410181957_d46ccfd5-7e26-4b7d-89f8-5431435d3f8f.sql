
-- Create trigger function to keep attendance_count in sync
CREATE OR REPLACE FUNCTION public.update_event_attendance_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.events
  SET attendance_count = (
    SELECT COUNT(*)::INTEGER
    FROM public.event_rsvps
    WHERE event_id = COALESCE(NEW.event_id, OLD.event_id)
    AND check_in_status = 'checked_in'
  )
  WHERE id = COALESCE(NEW.event_id, OLD.event_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach trigger to event_rsvps table
CREATE TRIGGER on_rsvp_checkin_update_attendance
  AFTER INSERT OR UPDATE OF check_in_status OR DELETE
  ON public.event_rsvps
  FOR EACH ROW
  EXECUTE FUNCTION public.update_event_attendance_count();

-- Backfill existing data
UPDATE public.events e
SET attendance_count = (
  SELECT COUNT(*)::INTEGER
  FROM public.event_rsvps r
  WHERE r.event_id = e.id
  AND r.check_in_status = 'checked_in'
);
