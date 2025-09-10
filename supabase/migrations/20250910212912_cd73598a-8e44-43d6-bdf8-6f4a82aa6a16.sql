-- Fix security issues by setting search_path for the new functions
CREATE OR REPLACE FUNCTION public.create_contact_activity_from_spheresync()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

-- Fix security issues by setting search_path for the update function
CREATE OR REPLACE FUNCTION public.update_contact_activity_from_spheresync()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

-- Fix security issues by setting search_path for the newsletter function
CREATE OR REPLACE FUNCTION public.log_newsletter_activity(
  p_contact_id uuid,
  p_agent_id uuid,
  p_campaign_name text,
  p_zip_code text DEFAULT NULL
)
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;