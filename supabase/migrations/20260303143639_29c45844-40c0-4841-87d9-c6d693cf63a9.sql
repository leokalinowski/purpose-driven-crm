
-- Add INSERT and UPDATE RLS policies so users can manage their own marketing settings row
CREATE POLICY "Users can insert their own marketing settings"
ON public.agent_marketing_settings
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own marketing settings"
ON public.agent_marketing_settings
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
