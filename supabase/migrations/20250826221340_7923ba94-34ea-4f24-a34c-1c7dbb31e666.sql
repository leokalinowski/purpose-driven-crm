-- Create monthly_runs table for tracking newsletter campaigns
CREATE TABLE public.monthly_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL,
  run_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  emails_sent INTEGER NOT NULL DEFAULT 0,
  contacts_processed INTEGER NOT NULL DEFAULT 0,
  zip_codes_processed INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE,
  finished_at TIMESTAMP WITH TIME ZONE,
  error TEXT,
  dry_run BOOLEAN NOT NULL DEFAULT false,
  triggered_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.monthly_runs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage monthly runs"
ON public.monthly_runs
FOR ALL
TO authenticated
USING (get_current_user_role() = 'admin')
WITH CHECK (get_current_user_role() = 'admin');

-- Create newsletter_settings table for agent configurations
CREATE TABLE public.newsletter_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  schedule_day INTEGER CHECK (schedule_day >= 1 AND schedule_day <= 31),
  schedule_hour INTEGER CHECK (schedule_hour >= 0 AND schedule_hour <= 23),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.newsletter_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage newsletter settings"
ON public.newsletter_settings
FOR ALL
TO authenticated
USING (get_current_user_role() = 'admin')
WITH CHECK (get_current_user_role() = 'admin');

-- Create trigger for updating timestamps
CREATE TRIGGER update_monthly_runs_updated_at
BEFORE UPDATE ON public.monthly_runs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_newsletter_settings_updated_at
BEFORE UPDATE ON public.newsletter_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();