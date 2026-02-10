
-- 1) workflow_runs: tracks each invocation of a workflow
CREATE TABLE public.workflow_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_name text NOT NULL,
  idempotency_key text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  started_at timestamptz DEFAULT now(),
  finished_at timestamptz,
  triggered_by text DEFAULT 'webhook',
  input jsonb,
  output jsonb,
  error_message text,
  error_details jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workflow_runs_unique_key UNIQUE (workflow_name, idempotency_key)
);

ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage workflow_runs"
  ON public.workflow_runs FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_workflow_runs_status ON public.workflow_runs (status);
CREATE INDEX idx_workflow_runs_workflow ON public.workflow_runs (workflow_name);

-- 2) workflow_run_steps: per-step tracking within a run
CREATE TABLE public.workflow_run_steps (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES public.workflow_runs(id) ON DELETE CASCADE,
  step_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  started_at timestamptz,
  finished_at timestamptz,
  attempt int NOT NULL DEFAULT 1,
  request jsonb,
  response_status int,
  response_body jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workflow_run_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage workflow_run_steps"
  ON public.workflow_run_steps FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_workflow_run_steps_run_id ON public.workflow_run_steps (run_id);

-- 3) social_shade_clickup_links: dedupe Shade files → ClickUp tasks
CREATE TABLE public.social_shade_clickup_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_marketing_settings_id text NOT NULL,
  shade_file_id text NOT NULL,
  shade_asset_id text,
  shade_path text,
  file_name text,
  transcription_id text,
  clickup_task_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT social_shade_clickup_links_unique UNIQUE (agent_marketing_settings_id, shade_file_id)
);

ALTER TABLE public.social_shade_clickup_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage social_shade_clickup_links"
  ON public.social_shade_clickup_links FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_social_shade_clickup_links_updated_at
  BEFORE UPDATE ON public.social_shade_clickup_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 4) content_generation_results: dedupe + store AI outputs per ClickUp task
CREATE TABLE public.content_generation_results (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clickup_task_id text NOT NULL UNIQUE,
  agent_marketing_settings_id text,
  shade_asset_id text,
  transcript_hash text,
  social_copy text,
  youtube_titles text,
  youtube_description text,
  generated_at timestamptz DEFAULT now(),
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.content_generation_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage content_generation_results"
  ON public.content_generation_results FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
