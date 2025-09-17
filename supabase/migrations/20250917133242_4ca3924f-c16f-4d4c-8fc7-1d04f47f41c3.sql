-- Phase 1: Fix Database Function Security Issues
-- Update all SECURITY DEFINER functions to have proper search_path settings

-- Fix log_newsletter_activity function
CREATE OR REPLACE FUNCTION public.log_newsletter_activity(p_contact_id uuid, p_agent_id uuid, p_campaign_name text, p_zip_code text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.contact_activities (
    contact_id,
    agent_id,
    activity_type,
    activity_date,
    notes,
    is_system_generated,
    system_source,
    metadata
  ) VALUES (
    p_contact_id,
    p_agent_id,
    'email',
    now(),
    CONCAT('Newsletter sent: ', p_campaign_name),
    true,
    'newsletter',
    jsonb_build_object(
      'campaign_name', p_campaign_name,
      'zip_code', p_zip_code,
      'email_type', 'newsletter'
    )
  );
END;
$function$;

-- Fix create_contact_activity_from_spheresync function
CREATE OR REPLACE FUNCTION public.create_contact_activity_from_spheresync()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  contact_uuid uuid;
BEGIN
  -- Get the contact UUID from the lead_id
  SELECT c.id INTO contact_uuid
  FROM public.contacts c
  WHERE c.id = NEW.lead_id;
  
  -- Only create activity if we found a matching contact
  IF contact_uuid IS NOT NULL THEN
    -- Create contact activity for the spheresync task
    INSERT INTO public.contact_activities (
      contact_id,
      agent_id,
      activity_type,
      activity_date,
      notes,
      is_system_generated,
      system_source,
      metadata
    ) VALUES (
      contact_uuid,
      NEW.agent_id,
      CASE 
        WHEN NEW.task_type = 'call' THEN 'call'::text
        WHEN NEW.task_type = 'text' THEN 'text'::text
        ELSE 'note'::text
      END,
      NEW.created_at,
      CASE 
        WHEN NEW.completed THEN 
          CONCAT('SphereSync ', NEW.task_type, ' task completed', 
                 CASE WHEN NEW.notes IS NOT NULL THEN ' - ' || NEW.notes ELSE '' END)
        ELSE 
          CONCAT('SphereSync ', NEW.task_type, ' task created')
      END,
      true,
      'spheresync',
      jsonb_build_object(
        'spheresync_task_id', NEW.id,
        'task_type', NEW.task_type,
        'week_number', NEW.week_number,
        'year', NEW.year,
        'completed', NEW.completed,
        'dnc_status', NEW.dnc_status
      )
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Fix update_contact_activity_from_spheresync function
CREATE OR REPLACE FUNCTION public.update_contact_activity_from_spheresync()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  contact_uuid uuid;
BEGIN
  -- Get the contact UUID from the lead_id
  SELECT c.id INTO contact_uuid
  FROM public.contacts c
  WHERE c.id = NEW.lead_id;
  
  -- Only update if we found a matching contact and completion status changed
  IF contact_uuid IS NOT NULL AND OLD.completed != NEW.completed THEN
    -- Update the existing contact activity or create completion entry
    IF NEW.completed THEN
      -- Update existing activity to show completion
      UPDATE public.contact_activities 
      SET 
        notes = CONCAT('SphereSync ', NEW.task_type, ' task completed',
                       CASE WHEN NEW.notes IS NOT NULL THEN ' - ' || NEW.notes ELSE '' END),
        updated_at = NEW.updated_at,
        metadata = metadata || jsonb_build_object(
          'completed', true,
          'completed_at', NEW.completed_at
        )
      WHERE contact_id = contact_uuid 
        AND system_source = 'spheresync'
        AND (metadata->>'spheresync_task_id')::uuid = NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Fix log_opportunity_activity function
CREATE OR REPLACE FUNCTION public.log_opportunity_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

-- Fix update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Add missing RLS policy for Leads_Table_Agents_Name table
ALTER TABLE public."Leads_Table_Agents_Name" ENABLE ROW LEVEL SECURITY;

-- Create a policy for agents to insert their own leads if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'Leads_Table_Agents_Name' 
        AND policyname = 'Agents can insert their own leads'
    ) THEN
        CREATE POLICY "Agents can insert their own leads" 
        ON public."Leads_Table_Agents_Name" 
        FOR INSERT 
        WITH CHECK (assigned_agent_id = auth.uid() OR get_current_user_role() = 'admin');
    END IF;
END $$;

-- Create policy to prevent unauthorized deletes
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'Leads_Table_Agents_Name' 
        AND policyname = 'Only admins can delete leads'
    ) THEN
        CREATE POLICY "Only admins can delete leads" 
        ON public."Leads_Table_Agents_Name" 
        FOR DELETE 
        USING (get_current_user_role() = 'admin');
    END IF;
END $$;