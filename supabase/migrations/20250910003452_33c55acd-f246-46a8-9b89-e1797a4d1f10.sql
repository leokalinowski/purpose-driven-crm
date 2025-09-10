-- CRITICAL SECURITY FIX: Remove all public access policies and create proper authenticated access

-- 1. Remove dangerous "Everyone can view" policies that expose data to public internet
DROP POLICY IF EXISTS "Everyone can view market stats" ON public.market_stats;
DROP POLICY IF EXISTS "Everyone can view events" ON public.events;
DROP POLICY IF EXISTS "Everyone can view social media analytics" ON public.social_media_analytics;
DROP POLICY IF EXISTS "Everyone can view automation runs" ON public.automation_runs;
DROP POLICY IF EXISTS "Everyone can view automation settings" ON public.automation_settings;

-- 2. Create secure authenticated policies for market_stats
-- Only authenticated agents and admins can view market data
CREATE POLICY "Authenticated users can view market stats" 
ON public.market_stats 
FOR SELECT 
TO authenticated
USING (true);

-- 3. Events table already has proper agent-specific policies, no additional policy needed
-- The existing policies "Users can view their own events" and "Admins can manage events" are sufficient

-- 4. Create secure policy for social_media_analytics  
-- Only agents can view their own analytics data, admins can view all
CREATE POLICY "Agents can view their own social media analytics" 
ON public.social_media_analytics 
FOR SELECT 
TO authenticated
USING ((created_by = auth.uid()) OR (get_current_user_role() = 'admin'));

-- 5. Automation tables should remain admin-only (existing admin policies are sufficient)
-- No additional policies needed for automation_runs and automation_settings