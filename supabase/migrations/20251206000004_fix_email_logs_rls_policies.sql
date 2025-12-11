-- Fix RLS policies for email_logs
-- Note: Service role key bypasses RLS entirely, so Edge Functions can always insert/update
-- This migration ensures SELECT policies work correctly for admin users

-- Verify the table exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'email_logs') THEN
    RAISE EXCEPTION 'email_logs table does not exist - please run migration 20251206000003_create_email_logs_table.sql first';
  END IF;
END $$;

-- Ensure SELECT policy allows admins to view all logs
-- Drop and recreate to ensure it's correct
DROP POLICY IF EXISTS "Admins can view all email logs" ON public.email_logs;

CREATE POLICY "Admins can view all email logs"
  ON public.email_logs
  FOR SELECT
  USING (get_current_user_role() = 'admin');

-- The INSERT policy is fine as-is - service role bypasses RLS anyway
-- But let's make sure it exists and is correct
DROP POLICY IF EXISTS "Admins can insert email logs" ON public.email_logs;
DROP POLICY IF EXISTS "Service role and admins can insert email logs" ON public.email_logs;

CREATE POLICY "Admins can insert email logs"
  ON public.email_logs
  FOR INSERT
  WITH CHECK (get_current_user_role() = 'admin');
  -- Note: Service role bypasses RLS, so Edge Functions can insert regardless of this policy

