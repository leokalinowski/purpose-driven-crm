-- Create opportunities table for pipeline management
CREATE TABLE public.opportunities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL,
  contact_id UUID REFERENCES public.contacts(id),
  stage TEXT NOT NULL CHECK (stage IN ('lead', 'qualified', 'appointment', 'contract', 'closed')),
  deal_value NUMERIC DEFAULT 0,
  expected_close_date DATE,
  actual_close_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

-- Create policies for agent access
CREATE POLICY "Agents can view their own opportunities" 
ON public.opportunities 
FOR SELECT 
USING (agent_id = auth.uid() OR get_current_user_role() = 'admin');

CREATE POLICY "Agents can create their own opportunities" 
ON public.opportunities 
FOR INSERT 
WITH CHECK (agent_id = auth.uid() OR get_current_user_role() = 'admin');

CREATE POLICY "Agents can update their own opportunities" 
ON public.opportunities 
FOR UPDATE 
USING (agent_id = auth.uid() OR get_current_user_role() = 'admin');

CREATE POLICY "Agents can delete their own opportunities" 
ON public.opportunities 
FOR DELETE 
USING (agent_id = auth.uid() OR get_current_user_role() = 'admin');

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_opportunities_updated_at
BEFORE UPDATE ON public.opportunities
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes for better performance
CREATE INDEX idx_opportunities_agent_id ON public.opportunities(agent_id);
CREATE INDEX idx_opportunities_stage ON public.opportunities(stage);
CREATE INDEX idx_opportunities_expected_close ON public.opportunities(expected_close_date);