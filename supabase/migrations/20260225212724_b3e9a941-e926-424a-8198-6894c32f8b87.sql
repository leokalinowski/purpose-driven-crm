ALTER TABLE newsletter_campaigns DROP CONSTRAINT IF EXISTS newsletter_campaigns_status_check;

ALTER TABLE newsletter_campaigns ADD CONSTRAINT newsletter_campaigns_status_check 
CHECK (status = ANY (ARRAY['draft'::text, 'sending'::text, 'sent'::text, 'scheduled'::text, 'completed'::text, 'failed'::text]));