
-- Create pipeline_survey_responses table
CREATE TABLE public.pipeline_survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name text NOT NULL,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  pipeline_stages text[] DEFAULT '{}',
  separate_buyer_seller text,
  must_have_fields text[] DEFAULT '{}',
  additional_fields text,
  follow_up_automation text,
  activity_types text[] DEFAULT '{}',
  integration_priorities text[] DEFAULT '{}',
  biggest_pain_point text,
  desired_views text[] DEFAULT '{}',
  mobile_importance text,
  additional_comments text
);

-- Enable RLS
ALTER TABLE public.pipeline_survey_responses ENABLE ROW LEVEL SECURITY;

-- Anyone can submit (public insert, no auth required)
CREATE POLICY "Public can submit survey"
  ON public.pipeline_survey_responses
  FOR INSERT
  WITH CHECK (true);

-- Only admins can read
CREATE POLICY "Admins can view survey responses"
  ON public.pipeline_survey_responses
  FOR SELECT
  USING (get_current_user_role() = 'admin');

-- Only admins can delete
CREATE POLICY "Admins can delete survey responses"
  ON public.pipeline_survey_responses
  FOR DELETE
  USING (get_current_user_role() = 'admin');
