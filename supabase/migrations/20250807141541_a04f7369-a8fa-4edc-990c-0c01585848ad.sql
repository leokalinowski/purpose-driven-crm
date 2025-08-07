-- Update events table structure for comprehensive event management
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS theme TEXT,
ADD COLUMN IF NOT EXISTS speakers TEXT[],
ADD COLUMN IF NOT EXISTS attendance_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS invited_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS leads_generated INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS feedback_summary TEXT,
ADD COLUMN IF NOT EXISTS registration_info TEXT,
ADD COLUMN IF NOT EXISTS quarter TEXT,
ADD COLUMN IF NOT EXISTS event_type TEXT DEFAULT 'upcoming',
ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES auth.users(id);

-- Enable RLS on events table if not already enabled
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for events
DROP POLICY IF EXISTS "Users can view their own events" ON public.events;
CREATE POLICY "Users can view their own events" 
ON public.events 
FOR SELECT 
USING (auth.uid() = agent_id);

DROP POLICY IF EXISTS "Users can create their own events" ON public.events;
CREATE POLICY "Users can create their own events" 
ON public.events 
FOR INSERT 
WITH CHECK (auth.uid() = agent_id);

DROP POLICY IF EXISTS "Users can update their own events" ON public.events;
CREATE POLICY "Users can update their own events" 
ON public.events 
FOR UPDATE 
USING (auth.uid() = agent_id);

-- Create event_tasks table for task management
CREATE TABLE IF NOT EXISTS public.event_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES auth.users(id) NOT NULL,
  task_name TEXT NOT NULL,
  responsible_person TEXT NOT NULL,
  due_date DATE,
  completed_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'overdue')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on event_tasks
ALTER TABLE public.event_tasks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for event_tasks
CREATE POLICY "Users can view their own event tasks" 
ON public.event_tasks 
FOR SELECT 
USING (auth.uid() = agent_id);

CREATE POLICY "Users can create their own event tasks" 
ON public.event_tasks 
FOR INSERT 
WITH CHECK (auth.uid() = agent_id);

CREATE POLICY "Users can update their own event tasks" 
ON public.event_tasks 
FOR UPDATE 
USING (auth.uid() = agent_id);

CREATE POLICY "Users can delete their own event tasks" 
ON public.event_tasks 
FOR DELETE 
USING (auth.uid() = agent_id);

-- Add trigger for updating timestamps
CREATE TRIGGER update_event_tasks_updated_at
BEFORE UPDATE ON public.event_tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();