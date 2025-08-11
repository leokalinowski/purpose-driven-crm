-- Create tables for automation run logs and settings
CREATE TABLE IF NOT EXISTS public.automation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running', -- running | success | error
  emails_sent INTEGER NOT NULL DEFAULT 0,
  zip_codes_processed INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  triggered_by UUID,
  test_zip TEXT,
  dry_run BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;

-- Everyone can view runs (read-only for non-admins)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'automation_runs' AND policyname = 'Everyone can view automation runs'
  ) THEN
    CREATE POLICY "Everyone can view automation runs"
      ON public.automation_runs
      FOR SELECT
      USING (true);
  END IF;
END $$;

-- Admins can manage runs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'automation_runs' AND policyname = 'Admins can manage automation runs'
  ) THEN
    CREATE POLICY "Admins can manage automation runs"
      ON public.automation_runs
      FOR ALL
      USING (get_current_user_role() = 'admin')
      WITH CHECK (get_current_user_role() = 'admin');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_automation_runs_created_at ON public.automation_runs (created_at DESC);

-- Settings table
CREATE TABLE IF NOT EXISTS public.automation_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  prompt_template TEXT,
  apify_max_results INTEGER NOT NULL DEFAULT 10,
  enabled BOOLEAN NOT NULL DEFAULT true
);

ALTER TABLE public.automation_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'automation_settings' AND policyname = 'Everyone can view automation settings'
  ) THEN
    CREATE POLICY "Everyone can view automation settings"
      ON public.automation_settings
      FOR SELECT
      USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'automation_settings' AND policyname = 'Admins can manage automation settings'
  ) THEN
    CREATE POLICY "Admins can manage automation settings"
      ON public.automation_settings
      FOR ALL
      USING (get_current_user_role() = 'admin')
      WITH CHECK (get_current_user_role() = 'admin');
  END IF;
END $$;

-- Trigger to keep updated_at fresh
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_automation_settings_updated_at'
  ) THEN
    CREATE TRIGGER update_automation_settings_updated_at
    BEFORE UPDATE ON public.automation_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Ensure extensions for scheduling HTTP calls exist
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Unschedule existing job if present, then schedule monthly run (1st of month at 00:00 UTC)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'monthly-zip-trends') THEN
    PERFORM cron.unschedule('monthly-zip-trends');
  END IF;

  PERFORM cron.schedule(
    'monthly-zip-trends',
    '0 0 1 * *',
    $cron$
    SELECT net.http_post(
      url:='https://cguoaokqwgqvzkqqezcq.supabase.co/functions/v1/monthly-zip-trends',
      headers:='{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNndW9hb2txd2dxdnprcXFlemNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0MTQ3OTEsImV4cCI6MjA2OTk5MDc5MX0.rOxOBbn4jZhCPkiCGpeNDi8_TtI8U_uZ9lvF2xvPecU"}'::jsonb,
      body:='{}'::jsonb
    );
    $cron$
  );
END$$;