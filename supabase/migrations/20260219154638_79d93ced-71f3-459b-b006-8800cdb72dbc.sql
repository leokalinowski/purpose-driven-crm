
-- Tighten the event_emails insert policy to require a valid event
DROP POLICY "Service role can insert event emails" ON public.event_emails;

CREATE POLICY "Authenticated can insert event emails for valid events"
  ON public.event_emails FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM events e WHERE e.id = event_emails.event_id
  ));
