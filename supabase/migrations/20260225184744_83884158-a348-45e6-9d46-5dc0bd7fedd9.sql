
ALTER TABLE public.email_logs 
ADD COLUMN campaign_id uuid REFERENCES public.newsletter_campaigns(id) ON DELETE SET NULL;

CREATE INDEX idx_email_logs_campaign_id ON public.email_logs(campaign_id);
