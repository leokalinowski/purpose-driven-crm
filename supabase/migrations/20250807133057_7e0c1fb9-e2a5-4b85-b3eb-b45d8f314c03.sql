-- Create leads table if it doesn't exist (seems like we have "Leads Table [Agent's Name]" but need proper structure)
-- First, let's create a proper leads table with better structure
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT NOT NULL,
  email TEXT,
  phone_number TEXT,
  category CHAR(1) NOT NULL,
  agent_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Create policies for leads table
CREATE POLICY "Agents can view their own leads" 
ON public.leads 
FOR SELECT 
USING (agent_id = auth.uid() OR get_current_user_role() = 'admin');

CREATE POLICY "Agents can update their own leads" 
ON public.leads 
FOR UPDATE 
USING (agent_id = auth.uid() OR get_current_user_role() = 'admin');

CREATE POLICY "Agents can insert their own leads" 
ON public.leads 
FOR INSERT 
WITH CHECK (agent_id = auth.uid() OR get_current_user_role() = 'admin');

CREATE POLICY "Admins can delete leads" 
ON public.leads 
FOR DELETE 
USING (get_current_user_role() = 'admin');

-- Create tasks table for PO2 tasks
CREATE TABLE public.po2_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_type TEXT NOT NULL CHECK (task_type IN ('call', 'text')),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL,
  week_number INTEGER NOT NULL CHECK (week_number >= 1 AND week_number <= 52),
  year INTEGER NOT NULL DEFAULT EXTRACT(year FROM now()),
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(lead_id, agent_id, task_type, week_number, year)
);

-- Enable RLS on tasks
ALTER TABLE public.po2_tasks ENABLE ROW LEVEL SECURITY;

-- Create policies for tasks
CREATE POLICY "Agents can view their own tasks" 
ON public.po2_tasks 
FOR SELECT 
USING (agent_id = auth.uid() OR get_current_user_role() = 'admin');

CREATE POLICY "Agents can update their own tasks" 
ON public.po2_tasks 
FOR UPDATE 
USING (agent_id = auth.uid() OR get_current_user_role() = 'admin');

CREATE POLICY "System can insert tasks" 
ON public.po2_tasks 
FOR INSERT 
WITH CHECK (agent_id = auth.uid() OR get_current_user_role() = 'admin');

CREATE POLICY "Admins can delete tasks" 
ON public.po2_tasks 
FOR DELETE 
USING (get_current_user_role() = 'admin');

-- Add trigger for automatic timestamps
CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_po2_tasks_updated_at
  BEFORE UPDATE ON public.po2_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to automatically set category based on last name
CREATE OR REPLACE FUNCTION public.set_lead_category()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.last_name IS NOT NULL AND length(NEW.last_name) > 0 THEN
    NEW.category = upper(left(NEW.last_name, 1));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically set category
CREATE TRIGGER set_lead_category_trigger
  BEFORE INSERT OR UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.set_lead_category();