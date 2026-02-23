
-- Fix 1: event_rsvp_answers - remove overly permissive INSERT policy
-- Answers are submitted via submit_rsvp_answers RPC (SECURITY DEFINER), so direct INSERT is not needed
DROP POLICY IF EXISTS "Authenticated can insert answers" ON public.event_rsvp_answers;

-- Fix 2: pipeline_survey_responses - tighten public INSERT to require non-empty fields
DROP POLICY IF EXISTS "Public can submit survey" ON public.pipeline_survey_responses;

CREATE POLICY "Public can submit survey with valid data"
ON public.pipeline_survey_responses
FOR INSERT
WITH CHECK (
  agent_name IS NOT NULL AND agent_name != '' AND
  email IS NOT NULL AND email != ''
);
