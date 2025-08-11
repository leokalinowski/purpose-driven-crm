-- Ensure RLS is enabled (safe if already enabled)
ALTER TABLE public.newsletter_campaigns ENABLE ROW LEVEL SECURITY;

-- Drop permissive policy if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'newsletter_campaigns'
      AND policyname = 'Everyone can view newsletter campaigns'
  ) THEN
    EXECUTE 'DROP POLICY "Everyone can view newsletter campaigns" ON public.newsletter_campaigns';
  END IF;
END $$;

-- Create owner-or-admin select policy only if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'newsletter_campaigns'
      AND policyname = 'Users can view their own newsletter campaigns'
  ) THEN
    EXECUTE $$
      CREATE POLICY "Users can view their own newsletter campaigns"
      ON public.newsletter_campaigns
      FOR SELECT
      USING (
        auth.uid() = created_by OR public.get_current_user_role() = 'admin'
      );
    $$;
  END IF;
END $$;