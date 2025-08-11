-- Create table to track ClickUp webhooks per list/event
CREATE TABLE IF NOT EXISTS public.clickup_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  list_id text NOT NULL,
  team_id text,
  webhook_id text,
  active boolean NOT NULL DEFAULT true,
  last_sync_at timestamptz,
  UNIQUE (list_id)
);

-- Enable Row Level Security
ALTER TABLE public.clickup_webhooks ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage webhooks"
ON public.clickup_webhooks
FOR ALL
USING (get_current_user_role() = 'admin')
WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "Agents can view webhooks for their events"
ON public.clickup_webhooks
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = clickup_webhooks.event_id
      AND (e.agent_id = auth.uid() OR get_current_user_role() = 'admin')
  )
);

-- Ensure update_updated_at_column exists (it does in this project), and attach trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_clickup_webhooks_updated_at'
  ) THEN
    CREATE TRIGGER trg_clickup_webhooks_updated_at
    BEFORE UPDATE ON public.clickup_webhooks
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;