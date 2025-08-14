-- Create coaching_submissions table
CREATE TABLE public.coaching_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.profiles(user_id),
  week_ending DATE NOT NULL,
  leads_contacted INTEGER NOT NULL DEFAULT 0,
  appointments_set INTEGER NOT NULL DEFAULT 0,
  deals_closed INTEGER NOT NULL DEFAULT 0,
  challenges TEXT,
  tasks TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.coaching_submissions ENABLE ROW LEVEL SECURITY;

-- Create policies for coaching_submissions
CREATE POLICY "Agents can view their own submissions" 
ON public.coaching_submissions 
FOR SELECT 
USING (agent_id = auth.uid() OR get_current_user_role() = 'admin');

CREATE POLICY "Agents can insert their own submissions" 
ON public.coaching_submissions 
FOR INSERT 
WITH CHECK (agent_id = auth.uid() OR get_current_user_role() = 'admin');

CREATE POLICY "Agents can update their own submissions" 
ON public.coaching_submissions 
FOR UPDATE 
USING (agent_id = auth.uid() OR get_current_user_role() = 'admin');

CREATE POLICY "Admins can delete submissions" 
ON public.coaching_submissions 
FOR DELETE 
USING (get_current_user_role() = 'admin');

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_coaching_submissions_updated_at
BEFORE UPDATE ON public.coaching_submissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better query performance
CREATE INDEX idx_coaching_submissions_agent_week ON public.coaching_submissions(agent_id, week_ending);
CREATE INDEX idx_coaching_submissions_week_ending ON public.coaching_submissions(week_ending);