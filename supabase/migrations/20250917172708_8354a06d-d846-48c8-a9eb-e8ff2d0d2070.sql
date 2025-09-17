-- CRITICAL SECURITY FIX: Secure leads_secure_summary table
-- This table contains sensitive customer data and currently has NO RLS protection

-- Enable Row Level Security on the leads_secure_summary table
ALTER TABLE public.leads_secure_summary ENABLE ROW LEVEL SECURITY;

-- Create RLS policies to restrict access based on agent assignments
-- Agents can only view leads assigned to them, admins can view all
CREATE POLICY "Agents can view their assigned lead summaries" 
ON public.leads_secure_summary 
FOR SELECT 
USING (
  (assigned_agent_id = auth.uid()) OR 
  (get_current_user_role() = 'admin')
);

-- Prevent unauthorized data modifications (only admins should be able to modify this summary table)
CREATE POLICY "Only admins can insert lead summaries" 
ON public.leads_secure_summary 
FOR INSERT 
WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "Only admins can update lead summaries" 
ON public.leads_secure_summary 
FOR UPDATE 
USING (get_current_user_role() = 'admin')
WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "Only admins can delete lead summaries" 
ON public.leads_secure_summary 
FOR DELETE 
USING (get_current_user_role() = 'admin');