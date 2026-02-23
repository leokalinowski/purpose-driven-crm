
-- 1. Create event_rsvp_questions table
CREATE TABLE public.event_rsvp_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'text',
  options JSONB,
  is_required BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.event_rsvp_questions ENABLE ROW LEVEL SECURITY;

-- Public can read questions (to render the form)
CREATE POLICY "Anyone can view event questions"
ON public.event_rsvp_questions FOR SELECT
USING (true);

-- Authenticated users can manage questions for their own events or admins for all
CREATE POLICY "Event owners and admins can insert questions"
ON public.event_rsvp_questions FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND (agent_id = auth.uid() OR created_by = auth.uid()))
  OR get_current_user_role() = 'admin'
);

CREATE POLICY "Event owners and admins can update questions"
ON public.event_rsvp_questions FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND (agent_id = auth.uid() OR created_by = auth.uid()))
  OR get_current_user_role() = 'admin'
);

CREATE POLICY "Event owners and admins can delete questions"
ON public.event_rsvp_questions FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND (agent_id = auth.uid() OR created_by = auth.uid()))
  OR get_current_user_role() = 'admin'
);

-- 2. Create event_rsvp_answers table
CREATE TABLE public.event_rsvp_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rsvp_id UUID NOT NULL REFERENCES public.event_rsvps(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.event_rsvp_questions(id) ON DELETE CASCADE,
  answer_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.event_rsvp_answers ENABLE ROW LEVEL SECURITY;

-- No public SELECT on answers - only via RPC
-- Authenticated owners/admins can read
CREATE POLICY "Event owners and admins can view answers"
ON public.event_rsvp_answers FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.event_rsvps er
    JOIN public.events e ON e.id = er.event_id
    WHERE er.id = rsvp_id
    AND (e.agent_id = auth.uid() OR e.created_by = auth.uid() OR get_current_user_role() = 'admin')
  )
);

-- No direct INSERT for anon - only via RPC
-- Authenticated can insert (for admin manual entry if needed)
CREATE POLICY "Authenticated can insert answers"
ON public.event_rsvp_answers FOR INSERT
TO authenticated
WITH CHECK (true);

-- 3. RPC: submit_rsvp_answers (for anonymous RSVP submissions)
CREATE OR REPLACE FUNCTION public.submit_rsvp_answers(
  p_rsvp_id UUID,
  p_answers JSONB -- array of {question_id, answer_text}
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_answer JSONB;
BEGIN
  -- Verify the RSVP exists
  IF NOT EXISTS (SELECT 1 FROM event_rsvps WHERE id = p_rsvp_id) THEN
    RAISE EXCEPTION 'RSVP not found';
  END IF;

  -- Insert each answer
  FOR v_answer IN SELECT * FROM jsonb_array_elements(p_answers)
  LOOP
    -- Verify the question exists
    IF EXISTS (SELECT 1 FROM event_rsvp_questions WHERE id = (v_answer->>'question_id')::UUID) THEN
      INSERT INTO event_rsvp_answers (rsvp_id, question_id, answer_text)
      VALUES (
        p_rsvp_id,
        (v_answer->>'question_id')::UUID,
        v_answer->>'answer_text'
      );
    END IF;
  END LOOP;
END;
$$;

-- 4. RPC: get_rsvp_answers (for authenticated event owners/admins)
CREATE OR REPLACE FUNCTION public.get_rsvp_answers(p_event_id UUID)
RETURNS TABLE(
  rsvp_id UUID,
  question_id UUID,
  question_text TEXT,
  question_type TEXT,
  answer_text TEXT,
  sort_order INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Verify caller owns the event or is admin
  IF NOT EXISTS (
    SELECT 1 FROM events
    WHERE id = p_event_id
    AND (agent_id = auth.uid() OR created_by = auth.uid())
  ) AND get_current_user_role() != 'admin' THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    a.rsvp_id,
    a.question_id,
    q.question_text,
    q.question_type,
    a.answer_text,
    q.sort_order
  FROM event_rsvp_answers a
  JOIN event_rsvp_questions q ON q.id = a.question_id
  JOIN event_rsvps er ON er.id = a.rsvp_id
  WHERE er.event_id = p_event_id
  ORDER BY a.rsvp_id, q.sort_order;
END;
$$;

-- Trigger for updated_at on questions
CREATE TRIGGER update_event_rsvp_questions_updated_at
BEFORE UPDATE ON public.event_rsvp_questions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
