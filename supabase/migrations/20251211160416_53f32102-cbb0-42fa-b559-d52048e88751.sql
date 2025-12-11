-- Add unique constraint on resend_email_id for upsert operations
ALTER TABLE email_logs 
ADD CONSTRAINT email_logs_resend_email_id_unique UNIQUE (resend_email_id);