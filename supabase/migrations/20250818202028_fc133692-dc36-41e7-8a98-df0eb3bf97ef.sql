-- Create opportunity_notes table for timestamped note entries
CREATE TABLE public.opportunity_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL,
  note_text TEXT NOT NULL,
  note_type TEXT DEFAULT 'general',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create opportunity_activities table for tracking all activities
CREATE TABLE public.opportunity_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL,
  activity_type TEXT NOT NULL,
  description TEXT,
  metadata JSONB,
  activity_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create opportunity_tasks table for task management within opportunities
CREATE TABLE public.opportunity_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL,
  task_name TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  status TEXT DEFAULT 'pending',
  priority TEXT DEFAULT 'medium',
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.opportunity_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_tasks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for opportunity_notes
CREATE POLICY "Agents can view notes for their opportunities" 
ON public.opportunity_notes 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.opportunities o 
    WHERE o.id = opportunity_notes.opportunity_id 
    AND (o.agent_id = auth.uid() OR get_current_user_role() = 'admin')
  )
);

CREATE POLICY "Agents can create notes for their opportunities" 
ON public.opportunity_notes 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.opportunities o 
    WHERE o.id = opportunity_notes.opportunity_id 
    AND (o.agent_id = auth.uid() OR get_current_user_role() = 'admin')
  )
);

CREATE POLICY "Agents can update their own notes" 
ON public.opportunity_notes 
FOR UPDATE 
USING (agent_id = auth.uid() OR get_current_user_role() = 'admin');

CREATE POLICY "Agents can delete their own notes" 
ON public.opportunity_notes 
FOR DELETE 
USING (agent_id = auth.uid() OR get_current_user_role() = 'admin');

-- Create RLS policies for opportunity_activities
CREATE POLICY "Agents can view activities for their opportunities" 
ON public.opportunity_activities 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.opportunities o 
    WHERE o.id = opportunity_activities.opportunity_id 
    AND (o.agent_id = auth.uid() OR get_current_user_role() = 'admin')
  )
);

CREATE POLICY "System can create activities for opportunities" 
ON public.opportunity_activities 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.opportunities o 
    WHERE o.id = opportunity_activities.opportunity_id 
    AND (o.agent_id = auth.uid() OR get_current_user_role() = 'admin')
  )
);

-- Create RLS policies for opportunity_tasks
CREATE POLICY "Agents can manage tasks for their opportunities" 
ON public.opportunity_tasks 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.opportunities o 
    WHERE o.id = opportunity_tasks.opportunity_id 
    AND (o.agent_id = auth.uid() OR get_current_user_role() = 'admin')
  )
);

-- Create triggers for updated_at columns
CREATE TRIGGER update_opportunity_notes_updated_at
BEFORE UPDATE ON public.opportunity_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_opportunity_tasks_updated_at
BEFORE UPDATE ON public.opportunity_tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to automatically log activities when opportunities change
CREATE OR REPLACE FUNCTION public.log_opportunity_activity()
RETURNS TRIGGER AS $$
BEGIN
  -- Log opportunity creation
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.opportunity_activities (
      opportunity_id, agent_id, activity_type, description
    ) VALUES (
      NEW.id, NEW.agent_id, 'created', 'Opportunity created'
    );
    RETURN NEW;
  END IF;

  -- Log stage changes
  IF TG_OP = 'UPDATE' AND OLD.stage != NEW.stage THEN
    INSERT INTO public.opportunity_activities (
      opportunity_id, agent_id, activity_type, description, metadata
    ) VALUES (
      NEW.id, NEW.agent_id, 'stage_change', 
      'Stage changed from ' || OLD.stage || ' to ' || NEW.stage,
      jsonb_build_object('old_stage', OLD.stage, 'new_stage', NEW.stage)
    );
  END IF;

  -- Log deal value changes
  IF TG_OP = 'UPDATE' AND OLD.deal_value != NEW.deal_value THEN
    INSERT INTO public.opportunity_activities (
      opportunity_id, agent_id, activity_type, description, metadata
    ) VALUES (
      NEW.id, NEW.agent_id, 'value_change', 
      'Deal value changed from $' || COALESCE(OLD.deal_value::text, '0') || ' to $' || COALESCE(NEW.deal_value::text, '0'),
      jsonb_build_object('old_value', OLD.deal_value, 'new_value', NEW.deal_value)
    );
  END IF;

  -- Log close date changes
  IF TG_OP = 'UPDATE' AND OLD.expected_close_date != NEW.expected_close_date THEN
    INSERT INTO public.opportunity_activities (
      opportunity_id, agent_id, activity_type, description, metadata
    ) VALUES (
      NEW.id, NEW.agent_id, 'date_change', 
      'Expected close date changed from ' || COALESCE(OLD.expected_close_date::text, 'not set') || ' to ' || COALESCE(NEW.expected_close_date::text, 'not set'),
      jsonb_build_object('old_date', OLD.expected_close_date, 'new_date', NEW.expected_close_date)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;