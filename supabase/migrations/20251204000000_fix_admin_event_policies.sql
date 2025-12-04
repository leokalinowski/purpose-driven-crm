-- Fix RLS policies to allow admins to create, view, and manage events for any agent
-- This migration makes the policies more permissive for admins while maintaining security for agents

-- Update SELECT policy to allow admins to view all events
DROP POLICY IF EXISTS "Users can view their own events" ON public.events;
CREATE POLICY "Users can view their own events" 
ON public.events 
FOR SELECT 
USING (auth.uid() = agent_id OR get_current_user_role() = 'admin');

-- Update INSERT policy to allow admins to create events for any agent
DROP POLICY IF EXISTS "Users can create their own events" ON public.events;
CREATE POLICY "Users can create their own events" 
ON public.events 
FOR INSERT 
WITH CHECK (auth.uid() = agent_id OR get_current_user_role() = 'admin');

-- Update DELETE policy to allow admins to delete any event
DROP POLICY IF EXISTS "Users can delete their own events" ON public.events;
CREATE POLICY "Users can delete their own events" 
ON public.events 
FOR DELETE 
USING (auth.uid() = agent_id OR get_current_user_role() = 'admin');

-- Update event_tasks policies to allow admins to manage tasks for any agent
DROP POLICY IF EXISTS "Users can view their own event tasks" ON public.event_tasks;
CREATE POLICY "Users can view their own event tasks" 
ON public.event_tasks 
FOR SELECT 
USING (auth.uid() = agent_id OR get_current_user_role() = 'admin');

DROP POLICY IF EXISTS "Users can create their own event tasks" ON public.event_tasks;
CREATE POLICY "Users can create their own event tasks" 
ON public.event_tasks 
FOR INSERT 
WITH CHECK (auth.uid() = agent_id OR get_current_user_role() = 'admin');

DROP POLICY IF EXISTS "Users can update their own event tasks" ON public.event_tasks;
CREATE POLICY "Users can update their own event tasks" 
ON public.event_tasks 
FOR UPDATE 
USING (auth.uid() = agent_id OR get_current_user_role() = 'admin')
WITH CHECK (auth.uid() = agent_id OR get_current_user_role() = 'admin');

DROP POLICY IF EXISTS "Users can delete their own event tasks" ON public.event_tasks;
CREATE POLICY "Users can delete their own event tasks" 
ON public.event_tasks 
FOR DELETE 
USING (auth.uid() = agent_id OR get_current_user_role() = 'admin');

