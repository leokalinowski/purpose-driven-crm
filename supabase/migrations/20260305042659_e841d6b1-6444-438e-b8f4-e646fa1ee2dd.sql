CREATE POLICY "Agents can view their own email logs"
ON public.email_logs
FOR SELECT
TO authenticated
USING (
  agent_id = auth.uid()
);