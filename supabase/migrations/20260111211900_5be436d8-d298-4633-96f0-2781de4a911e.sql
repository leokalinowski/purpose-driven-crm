-- Allow public to view RSVPs for published events (needed for duplicate checking and confirmation)
CREATE POLICY "Public can view RSVPs for published events"
ON public.event_rsvps
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM events e 
    WHERE e.id = event_rsvps.event_id 
    AND e.is_published = true
  )
);