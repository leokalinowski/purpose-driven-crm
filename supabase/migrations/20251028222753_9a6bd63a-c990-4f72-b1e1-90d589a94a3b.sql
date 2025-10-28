-- Add RLS policies for agents table
CREATE POLICY "Authenticated users can view agents"
ON public.agents FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins insert agents"
ON public.agents FOR INSERT
TO authenticated
WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "Admins update agents"
ON public.agents FOR UPDATE
TO authenticated
USING (get_current_user_role() = 'admin')
WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "Admins delete agents"
ON public.agents FOR DELETE
TO authenticated
USING (get_current_user_role() = 'admin');

-- Add RLS policies for transactions table
CREATE POLICY "Agents view own transactions"
ON public.transactions FOR SELECT
TO authenticated
USING (
  agent_id = auth.uid() 
  OR get_current_user_role() = 'admin'
);

CREATE POLICY "Admins insert transactions"
ON public.transactions FOR INSERT
TO authenticated
WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "Admins update transactions"
ON public.transactions FOR UPDATE
TO authenticated
USING (get_current_user_role() = 'admin')
WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "Admins delete transactions"
ON public.transactions FOR DELETE
TO authenticated
USING (get_current_user_role() = 'admin');

-- Add RLS policies for role_change_audit
CREATE POLICY "Only admins view role audits"
ON public.role_change_audit FOR SELECT
TO authenticated
USING (get_current_user_role() = 'admin');

CREATE POLICY "Only admins insert role audits"
ON public.role_change_audit FOR INSERT
TO authenticated
WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "Only admins update role audits"
ON public.role_change_audit FOR UPDATE
TO authenticated
USING (get_current_user_role() = 'admin')
WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "Only admins delete role audits"
ON public.role_change_audit FOR DELETE
TO authenticated
USING (get_current_user_role() = 'admin');

-- Add RLS policies for newsletter_csv_files
CREATE POLICY "Admins select CSV files"
ON public.newsletter_csv_files FOR SELECT
TO authenticated
USING (get_current_user_role() = 'admin');

CREATE POLICY "Admins insert CSV files"
ON public.newsletter_csv_files FOR INSERT
TO authenticated
WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "Admins update CSV files"
ON public.newsletter_csv_files FOR UPDATE
TO authenticated
USING (get_current_user_role() = 'admin')
WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "Admins delete CSV files"
ON public.newsletter_csv_files FOR DELETE
TO authenticated
USING (get_current_user_role() = 'admin');

-- Add RLS policies for newsletter_market_data
CREATE POLICY "Authenticated users view market data"
ON public.newsletter_market_data FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins insert market data"
ON public.newsletter_market_data FOR INSERT
TO authenticated
WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "Admins update market data"
ON public.newsletter_market_data FOR UPDATE
TO authenticated
USING (get_current_user_role() = 'admin')
WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "Admins delete market data"
ON public.newsletter_market_data FOR DELETE
TO authenticated
USING (get_current_user_role() = 'admin');