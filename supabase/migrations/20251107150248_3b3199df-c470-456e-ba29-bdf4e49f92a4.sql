-- Remove the unique constraint on email to allow multiple invitations per email
ALTER TABLE public.invitations 
DROP CONSTRAINT IF EXISTS invitations_email_key;

-- Change the default expiration to 30 days instead of 7 days
ALTER TABLE public.invitations 
ALTER COLUMN expires_at SET DEFAULT (now() + interval '30 days');

-- Add a simple index for better query performance on email lookups
CREATE INDEX IF NOT EXISTS idx_invitations_email 
ON public.invitations(email);