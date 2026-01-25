-- Create agent_marketing_settings table
CREATE TABLE public.agent_marketing_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Branding
  primary_color TEXT,
  secondary_color TEXT,
  headshot_url TEXT,
  logo_colored_url TEXT,
  logo_white_url TEXT,
  
  -- Content Guidelines
  gpt_prompt TEXT,
  brand_guidelines TEXT,
  example_copy TEXT,
  target_audience TEXT,
  tone_guidelines TEXT,
  what_not_to_say TEXT,
  thumbnail_guidelines TEXT,
  
  -- Integration IDs
  metricool_creds JSONB,
  clickup_editing_task_list_id TEXT,
  clickup_video_deliverables_list_id TEXT,
  shade_folder_id TEXT,
  editors TEXT[],
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.agent_marketing_settings ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage all marketing settings"
  ON public.agent_marketing_settings FOR ALL
  USING (get_current_user_role() = 'admin')
  WITH CHECK (get_current_user_role() = 'admin');

-- Users can view their own settings (read-only)
CREATE POLICY "Users can view their own marketing settings"
  ON public.agent_marketing_settings FOR SELECT
  USING (user_id = auth.uid() OR get_current_user_role() = 'admin');

-- Add updated_at trigger
CREATE TRIGGER update_agent_marketing_settings_updated_at
  BEFORE UPDATE ON public.agent_marketing_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Migrate existing data from profiles
INSERT INTO public.agent_marketing_settings (
  user_id,
  primary_color,
  secondary_color,
  headshot_url,
  logo_colored_url,
  logo_white_url,
  gpt_prompt,
  brand_guidelines,
  example_copy,
  target_audience,
  tone_guidelines,
  what_not_to_say,
  thumbnail_guidelines,
  metricool_creds,
  clickup_editing_task_list_id,
  clickup_video_deliverables_list_id,
  shade_folder_id,
  editors
)
SELECT
  user_id,
  primary_color,
  secondary_color,
  headshot_url,
  logo_colored_url,
  logo_white_url,
  gpt_prompt,
  brand_guidelines,
  COALESCE(example_copy, "Example Copy"),
  "Target Audience",
  "Tone Guidelines",
  "What NOT to Say",
  "Thumbnail Guidelines",
  metricool_creds,
  clickup_editing_task_list_id,
  clickup_video_deliverables_list_id,
  shade_folder_id,
  editors
FROM public.profiles
WHERE user_id IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;