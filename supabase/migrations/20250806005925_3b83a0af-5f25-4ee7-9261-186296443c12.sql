-- Create profiles table for user management
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('admin', 'agent')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Add missing columns to existing leads table
ALTER TABLE public."Leads Table [Agent's Name]" 
ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
ADD COLUMN IF NOT EXISTS source TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'archived')),
ADD COLUMN IF NOT EXISTS assigned_agent_id UUID REFERENCES public.profiles(user_id),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Enable RLS on leads table
ALTER TABLE public."Leads Table [Agent's Name]" ENABLE ROW LEVEL SECURITY;

-- Create DTD2 tasks table
CREATE TABLE public.dtd2_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public."Leads Table [Agent's Name]"(id) ON DELETE CASCADE,
  week_starting DATE NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.dtd2_tasks ENABLE ROW LEVEL SECURITY;

-- Create events table
CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  location TEXT,
  event_type TEXT,
  attendance_count INTEGER DEFAULT 0,
  feedback_score DECIMAL(3,2),
  created_by UUID REFERENCES public.profiles(user_id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Create social media analytics table
CREATE TABLE public.social_media_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL,
  metric_type TEXT NOT NULL,
  metric_value INTEGER NOT NULL,
  metric_date DATE NOT NULL,
  created_by UUID REFERENCES public.profiles(user_id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.social_media_analytics ENABLE ROW LEVEL SECURITY;

-- Create newsletter campaigns table
CREATE TABLE public.newsletter_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_name TEXT NOT NULL,
  send_date DATE,
  recipient_count INTEGER DEFAULT 0,
  open_rate DECIMAL(5,2),
  click_through_rate DECIMAL(5,2),
  template_content TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'scheduled')),
  created_by UUID REFERENCES public.profiles(user_id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.newsletter_campaigns ENABLE ROW LEVEL SECURITY;

-- Create coaching sessions table
CREATE TABLE public.coaching_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  duration_minutes INTEGER,
  topics_covered TEXT,
  progress_notes TEXT,
  coach_id UUID REFERENCES public.profiles(user_id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.coaching_sessions ENABLE ROW LEVEL SECURITY;

-- Create transaction coordination table
CREATE TABLE public.transaction_coordination (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public."Leads Table [Agent's Name]"(id),
  property_address TEXT,
  transaction_stage TEXT NOT NULL DEFAULT 'under_contract' CHECK (transaction_stage IN ('under_contract', 'inspection', 'financing', 'closing', 'completed')),
  contract_date DATE,
  closing_date DATE,
  sale_price DECIMAL(12,2),
  responsible_agent UUID REFERENCES public.profiles(user_id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.transaction_coordination ENABLE ROW LEVEL SECURITY;

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public."Leads Table [Agent's Name]"
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_newsletter_campaigns_updated_at
  BEFORE UPDATE ON public.newsletter_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_coaching_sessions_updated_at
  BEFORE UPDATE ON public.coaching_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_transaction_coordination_updated_at
  BEFORE UPDATE ON public.transaction_coordination
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, first_name, last_name, email)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user registration
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create security definer function to get current user role
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Only admins can insert profiles" ON public.profiles
  FOR INSERT WITH CHECK (public.get_current_user_role() = 'admin' OR auth.uid() = user_id);

CREATE POLICY "Only admins can delete profiles" ON public.profiles
  FOR DELETE USING (public.get_current_user_role() = 'admin');

-- RLS Policies for leads
CREATE POLICY "Admins can view all leads" ON public."Leads Table [Agent's Name]"
  FOR SELECT USING (public.get_current_user_role() = 'admin');

CREATE POLICY "Agents can view their assigned leads" ON public."Leads Table [Agent's Name]"
  FOR SELECT USING (assigned_agent_id = auth.uid() OR public.get_current_user_role() = 'admin');

CREATE POLICY "Admins can insert leads" ON public."Leads Table [Agent's Name]"
  FOR INSERT WITH CHECK (public.get_current_user_role() = 'admin');

CREATE POLICY "Admins can update leads" ON public."Leads Table [Agent's Name]"
  FOR UPDATE USING (public.get_current_user_role() = 'admin');

CREATE POLICY "Agents can update their assigned leads" ON public."Leads Table [Agent's Name]"
  FOR UPDATE USING (assigned_agent_id = auth.uid() OR public.get_current_user_role() = 'admin');

-- RLS Policies for DTD2 tasks
CREATE POLICY "Users can view their own DTD2 tasks" ON public.dtd2_tasks
  FOR SELECT USING (agent_id = auth.uid() OR public.get_current_user_role() = 'admin');

CREATE POLICY "Admins can manage all DTD2 tasks" ON public.dtd2_tasks
  FOR ALL USING (public.get_current_user_role() = 'admin');

CREATE POLICY "Agents can update their own DTD2 tasks" ON public.dtd2_tasks
  FOR UPDATE USING (agent_id = auth.uid());

-- RLS Policies for events
CREATE POLICY "Everyone can view events" ON public.events
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage events" ON public.events
  FOR ALL USING (public.get_current_user_role() = 'admin');

-- RLS Policies for social media analytics
CREATE POLICY "Everyone can view social media analytics" ON public.social_media_analytics
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage social media analytics" ON public.social_media_analytics
  FOR ALL USING (public.get_current_user_role() = 'admin');

-- RLS Policies for newsletter campaigns
CREATE POLICY "Everyone can view newsletter campaigns" ON public.newsletter_campaigns
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage newsletter campaigns" ON public.newsletter_campaigns
  FOR ALL USING (public.get_current_user_role() = 'admin');

-- RLS Policies for coaching sessions
CREATE POLICY "Users can view their own coaching sessions" ON public.coaching_sessions
  FOR SELECT USING (agent_id = auth.uid() OR coach_id = auth.uid() OR public.get_current_user_role() = 'admin');

CREATE POLICY "Admins and coaches can manage coaching sessions" ON public.coaching_sessions
  FOR ALL USING (public.get_current_user_role() = 'admin' OR coach_id = auth.uid());

-- RLS Policies for transaction coordination
CREATE POLICY "Users can view transactions they're responsible for" ON public.transaction_coordination
  FOR SELECT USING (responsible_agent = auth.uid() OR public.get_current_user_role() = 'admin');

CREATE POLICY "Admins can manage all transactions" ON public.transaction_coordination
  FOR ALL USING (public.get_current_user_role() = 'admin');

CREATE POLICY "Agents can update their transactions" ON public.transaction_coordination
  FOR UPDATE USING (responsible_agent = auth.uid() OR public.get_current_user_role() = 'admin');