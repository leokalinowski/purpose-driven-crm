-- Create contacts table for managing agent contacts
CREATE TABLE public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL,
  first_name TEXT,
  last_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address_1 TEXT,
  address_2 TEXT,
  zip_code TEXT,
  state TEXT,
  city TEXT,
  tags TEXT[],
  dnc BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  category CHARACTER(1) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- Create policies for contact access
CREATE POLICY "Agents can view their own contacts" 
ON public.contacts 
FOR SELECT 
USING (agent_id = auth.uid() OR get_current_user_role() = 'admin');

CREATE POLICY "Agents can insert their own contacts" 
ON public.contacts 
FOR INSERT 
WITH CHECK (agent_id = auth.uid() OR get_current_user_role() = 'admin');

CREATE POLICY "Agents can update their own contacts" 
ON public.contacts 
FOR UPDATE 
USING (agent_id = auth.uid() OR get_current_user_role() = 'admin');

CREATE POLICY "Agents can delete their own contacts" 
ON public.contacts 
FOR DELETE 
USING (agent_id = auth.uid() OR get_current_user_role() = 'admin');

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_contacts_updated_at
BEFORE UPDATE ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for automatic category assignment
CREATE TRIGGER set_contact_category
BEFORE INSERT OR UPDATE ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION public.set_lead_category();

-- Create index for better performance
CREATE INDEX idx_contacts_agent_id ON public.contacts(agent_id);
CREATE INDEX idx_contacts_last_name ON public.contacts(last_name);
CREATE INDEX idx_contacts_category ON public.contacts(category);