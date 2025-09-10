-- Create contact activities table for tracking all interactions
CREATE TABLE public.contact_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('call', 'text', 'email', 'meeting', 'note', 'task')),
  activity_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  duration_minutes INTEGER,
  outcome TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on contact activities
ALTER TABLE public.contact_activities ENABLE ROW LEVEL SECURITY;

-- RLS policies for contact activities
CREATE POLICY "Agents can view activities for their contacts" 
ON public.contact_activities 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.contacts c 
    WHERE c.id = contact_activities.contact_id 
    AND (c.agent_id = auth.uid() OR get_current_user_role() = 'admin')
  )
);

CREATE POLICY "Agents can insert activities for their contacts" 
ON public.contact_activities 
FOR INSERT 
WITH CHECK (
  agent_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.contacts c 
    WHERE c.id = contact_activities.contact_id 
    AND (c.agent_id = auth.uid() OR get_current_user_role() = 'admin')
  )
);

CREATE POLICY "Agents can update their own activities" 
ON public.contact_activities 
FOR UPDATE 
USING (
  agent_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.contacts c 
    WHERE c.id = contact_activities.contact_id 
    AND (c.agent_id = auth.uid() OR get_current_user_role() = 'admin')
  )
);

CREATE POLICY "Agents can delete their own activities" 
ON public.contact_activities 
FOR DELETE 
USING (
  agent_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.contacts c 
    WHERE c.id = contact_activities.contact_id 
    AND (c.agent_id = auth.uid() OR get_current_user_role() = 'admin')
  )
);

-- Add indexes for performance optimization
CREATE INDEX idx_contacts_agent_id ON public.contacts(agent_id);
CREATE INDEX idx_contacts_phone ON public.contacts(phone);
CREATE INDEX idx_contacts_dnc ON public.contacts(dnc);
CREATE INDEX idx_contacts_dnc_last_checked ON public.contacts(dnc_last_checked);
CREATE INDEX idx_contacts_search ON public.contacts USING gin(to_tsvector('english', first_name || ' ' || COALESCE(last_name, '') || ' ' || COALESCE(email, '')));
CREATE INDEX idx_contacts_tags ON public.contacts USING gin(tags);
CREATE INDEX idx_contact_activities_contact_id ON public.contact_activities(contact_id);
CREATE INDEX idx_contact_activities_agent_id ON public.contact_activities(agent_id);
CREATE INDEX idx_contact_activities_type_date ON public.contact_activities(activity_type, activity_date);

-- Add function to update contact last_activity_date
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS last_activity_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS activity_count INTEGER DEFAULT 0;

-- Function to update contact activity stats
CREATE OR REPLACE FUNCTION public.update_contact_activity_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.contacts 
  SET 
    last_activity_date = (
      SELECT MAX(activity_date) 
      FROM public.contact_activities 
      WHERE contact_id = COALESCE(NEW.contact_id, OLD.contact_id)
    ),
    activity_count = (
      SELECT COUNT(*) 
      FROM public.contact_activities 
      WHERE contact_id = COALESCE(NEW.contact_id, OLD.contact_id)
    )
  WHERE id = COALESCE(NEW.contact_id, OLD.contact_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update contact activity stats
CREATE TRIGGER update_contact_activity_stats_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.contact_activities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_contact_activity_stats();

-- Add trigger for contact_activities updated_at
CREATE TRIGGER update_contact_activities_updated_at
  BEFORE UPDATE ON public.contact_activities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to normalize phone numbers (remove all non-digits)
CREATE OR REPLACE FUNCTION public.normalize_phone(phone_input TEXT)
RETURNS TEXT AS $$
BEGIN
  IF phone_input IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Remove all non-digit characters
  RETURN regexp_replace(phone_input, '[^0-9]', '', 'g');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to validate phone numbers
CREATE OR REPLACE FUNCTION public.is_valid_phone(phone_input TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  normalized_phone TEXT;
BEGIN
  IF phone_input IS NULL THEN
    RETURN false;
  END IF;
  
  normalized_phone := public.normalize_phone(phone_input);
  
  -- Valid phone numbers should be 10-15 digits
  RETURN normalized_phone ~ '^[0-9]{10,15}$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to format phone numbers for display (US format)
CREATE OR REPLACE FUNCTION public.format_phone_display(phone_input TEXT)
RETURNS TEXT AS $$
DECLARE
  normalized_phone TEXT;
BEGIN
  IF phone_input IS NULL THEN
    RETURN NULL;
  END IF;
  
  normalized_phone := public.normalize_phone(phone_input);
  
  -- Format US 10-digit numbers as (XXX) XXX-XXXX
  IF length(normalized_phone) = 10 THEN
    RETURN '(' || substring(normalized_phone, 1, 3) || ') ' || 
           substring(normalized_phone, 4, 3) || '-' || 
           substring(normalized_phone, 7, 4);
  -- Format 11-digit numbers (with country code) as +1 (XXX) XXX-XXXX
  ELSIF length(normalized_phone) = 11 AND substring(normalized_phone, 1, 1) = '1' THEN
    RETURN '+1 (' || substring(normalized_phone, 2, 3) || ') ' || 
           substring(normalized_phone, 5, 3) || '-' || 
           substring(normalized_phone, 8, 4);
  ELSE
    -- For other lengths, just return normalized
    RETURN normalized_phone;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Clean existing phone numbers
UPDATE public.contacts 
SET phone = public.normalize_phone(phone) 
WHERE phone IS NOT NULL AND phone != public.normalize_phone(phone);

-- Add constraint to ensure phone numbers are normalized on insert/update
CREATE OR REPLACE FUNCTION public.normalize_contact_phone()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.phone IS NOT NULL THEN
    NEW.phone := public.normalize_phone(NEW.phone);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER normalize_contact_phone_trigger
  BEFORE INSERT OR UPDATE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_contact_phone();