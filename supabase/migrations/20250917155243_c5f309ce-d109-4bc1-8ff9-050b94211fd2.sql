-- Fix security linter warnings from previous migration

-- 1. Fix Security Definer View issue - recreate view without security definer
DROP VIEW IF EXISTS leads_secure_summary;
CREATE VIEW leads_secure_summary AS 
SELECT 
  user_id,
  assigned_agent_id,
  first_name,
  LEFT(COALESCE(last_name, ''), 1) || CASE WHEN length(COALESCE(last_name, '')) > 1 THEN '***' ELSE '' END as last_name_masked,
  mask_email(email) as email_masked,
  mask_phone(phone::text) as phone_masked,
  city,
  state,
  zip_code,
  status,
  source,
  created_at,
  updated_at
FROM "Leads_Table_Agents_Name";

-- Grant access and apply security barrier without SECURITY DEFINER
GRANT SELECT ON leads_secure_summary TO authenticated;
ALTER VIEW leads_secure_summary SET (security_barrier = true);

-- 2. Fix Function Search Path Mutable warnings by adding SET search_path
CREATE OR REPLACE FUNCTION log_sensitive_data_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Log all changes to tables containing PII/sensitive data
  INSERT INTO security_audit_log (
    user_id, 
    table_name, 
    operation, 
    old_values, 
    new_values
  ) VALUES (
    auth.uid(), 
    TG_TABLE_NAME, 
    TG_OP,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN 
      jsonb_build_object(
        'id', OLD.user_id,
        'email', CASE WHEN TG_TABLE_NAME = 'Leads_Table_Agents_Name' THEN OLD.email ELSE NULL END,
        'phone', CASE WHEN TG_TABLE_NAME = 'Leads_Table_Agents_Name' THEN OLD.phone ELSE NULL END
      )
    ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN 
      jsonb_build_object(
        'id', NEW.user_id,
        'email', CASE WHEN TG_TABLE_NAME = 'Leads_Table_Agents_Name' THEN NEW.email ELSE NULL END,
        'phone', CASE WHEN TG_TABLE_NAME = 'Leads_Table_Agents_Name' THEN NEW.phone ELSE NULL END
      )
    ELSE NULL END
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION mask_email(email_address text)
RETURNS text AS $$
BEGIN
    IF email_address IS NULL OR email_address = '' THEN
        RETURN NULL;
    END IF;
    
    -- Mask email: show first 2 chars + *** + domain
    RETURN LEFT(SPLIT_PART(email_address, '@', 1), 2) || '***@' || 
           SPLIT_PART(email_address, '@', 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION mask_phone(phone_number text)
RETURNS text AS $$
BEGIN
    IF phone_number IS NULL OR phone_number = '' THEN
        RETURN NULL;
    END IF;
    
    -- Mask phone: show last 4 digits only
    RETURN '***-***-' || RIGHT(regexp_replace(phone_number, '[^0-9]', '', 'g'), 4);
END;
$$ LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION validate_agent_assignment()
RETURNS TRIGGER AS $$
BEGIN
    -- Ensure assigned_agent_id is never NULL on new inserts
    IF TG_OP = 'INSERT' AND NEW.assigned_agent_id IS NULL THEN
        -- Auto-assign to the current user if they're an agent
        IF get_current_user_role() IN ('agent', 'admin') THEN
            NEW.assigned_agent_id := auth.uid();
        ELSE
            RAISE EXCEPTION 'assigned_agent_id cannot be NULL. All leads must be assigned to an agent.';
        END IF;
    END IF;
    
    -- Ensure assigned_agent_id is never set to NULL on updates
    IF TG_OP = 'UPDATE' AND NEW.assigned_agent_id IS NULL THEN
        RAISE EXCEPTION 'assigned_agent_id cannot be set to NULL. All leads must remain assigned to an agent.';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;