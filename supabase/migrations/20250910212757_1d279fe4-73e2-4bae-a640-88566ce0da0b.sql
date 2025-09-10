-- Add system activity indicator to contact_activities
ALTER TABLE public.contact_activities 
ADD COLUMN IF NOT EXISTS is_system_generated boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS system_source text;

-- Create function to automatically create contact activity from spheresync task
CREATE OR REPLACE FUNCTION public.create_contact_activity_from_spheresync()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to update contact activity when spheresync task is updated
CREATE OR REPLACE FUNCTION public.update_contact_activity_from_spheresync()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for spheresync_tasks
DROP TRIGGER IF EXISTS trigger_spheresync_task_insert ON public.spheresync_tasks;
CREATE TRIGGER trigger_spheresync_task_insert
  AFTER INSERT ON public.spheresync_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.create_contact_activity_from_spheresync();

DROP TRIGGER IF EXISTS trigger_spheresync_task_update ON public.spheresync_tasks;
CREATE TRIGGER trigger_spheresync_task_update
  AFTER UPDATE ON public.spheresync_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_contact_activity_from_spheresync();

-- Backfill existing spheresync_tasks as contact_activities
INSERT INTO public.contact_activities (
  contact_id,
  agent_id,
  activity_type,
  activity_date,
  notes,
  is_system_generated,
  system_source,
  metadata,
  created_at,
  updated_at
)
SELECT 
  c.id as contact_id,
  st.agent_id,
  CASE 
    WHEN st.task_type = 'call' THEN 'call'::text
    WHEN st.task_type = 'text' THEN 'text'::text
    ELSE 'note'::text
  END as activity_type,
  st.created_at as activity_date,
  CASE 
    WHEN st.completed THEN 
      CONCAT('SphereSync ', st.task_type, ' task completed', 
             CASE WHEN st.notes IS NOT NULL THEN ' - ' || st.notes ELSE '' END)
    ELSE 
      CONCAT('SphereSync ', st.task_type, ' task created')
  END as notes,
  true as is_system_generated,
  'spheresync' as system_source,
  jsonb_build_object(
    'spheresync_task_id', st.id,
    'task_type', st.task_type,
    'week_number', st.week_number,
    'year', st.year,
    'completed', st.completed,
    'dnc_status', st.dnc_status,
    'completed_at', st.completed_at
  ) as metadata,
  st.created_at,
  st.updated_at
FROM public.spheresync_tasks st
JOIN public.contacts c ON c.id = st.lead_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.contact_activities ca 
  WHERE ca.system_source = 'spheresync' 
    AND (ca.metadata->>'spheresync_task_id')::uuid = st.id
);

-- Create function to log newsletter email activities
CREATE OR REPLACE FUNCTION public.log_newsletter_activity(
  p_contact_id uuid,
  p_agent_id uuid,
  p_campaign_name text,
  p_zip_code text DEFAULT NULL
)
RETURNS void AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;