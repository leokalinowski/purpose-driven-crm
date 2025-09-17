-- Security Enhancement: Fix critical vulnerabilities (final version)

-- 1. Fix Leads_Table_Agents_Name NULL assigned_agent_id security gap
DO $$
DECLARE
    admin_user_id uuid;
    null_count integer;
BEGIN
    -- Check if there are any NULL assigned_agent_id records
    SELECT COUNT(*) INTO null_count 
    FROM "Leads_Table_Agents_Name" 
    WHERE assigned_agent_id IS NULL;
    
    IF null_count > 0 THEN
        -- Get the first admin user ID
        SELECT user_id INTO admin_user_id 
        FROM profiles 
        WHERE role = 'admin' 
        LIMIT 1;
        
        IF admin_user_id IS NOT NULL THEN
            -- Update NULL assigned_agent_id records to admin
            UPDATE "Leads_Table_Agents_Name" 
            SET assigned_agent_id = admin_user_id 
            WHERE assigned_agent_id IS NULL;
            
            RAISE NOTICE 'Security Fix: Updated % leads with NULL assigned_agent_id to admin user', null_count;
        ELSE
            RAISE NOTICE 'Warning: % leads with NULL assigned_agent_id found but no admin user exists', null_count;
        END IF;
    ELSE
        RAISE NOTICE 'Security Check: No leads with NULL assigned_agent_id found';
    END IF;
END $$;

-- 2. Add comprehensive audit logging for sensitive operations
CREATE TABLE IF NOT EXISTS security_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  table_name text NOT NULL,
  operation text NOT NULL,
  old_values jsonb,
  new_values jsonb,
  ip_address inet,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;

-- Create policy for audit log access (only admins can view)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'security_audit_log' 
        AND policyname = 'Only admins can view security audit logs'
    ) THEN
        CREATE POLICY "Only admins can view security audit logs" 
        ON security_audit_log FOR SELECT 
        USING (get_current_user_role() = 'admin');
    END IF;
END $$;

-- 3. Create comprehensive audit function for sensitive data changes
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Apply audit triggers to sensitive tables
DROP TRIGGER IF EXISTS security_audit_leads ON "Leads_Table_Agents_Name";
CREATE TRIGGER security_audit_leads 
  AFTER INSERT OR UPDATE OR DELETE ON "Leads_Table_Agents_Name"
  FOR EACH ROW EXECUTE FUNCTION log_sensitive_data_changes();

DROP TRIGGER IF EXISTS security_audit_contacts ON contacts;
CREATE TRIGGER security_audit_contacts 
  AFTER INSERT OR UPDATE OR DELETE ON contacts
  FOR EACH ROW EXECUTE FUNCTION log_sensitive_data_changes();

-- 5. Create data masking functions for safe display
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
$$ LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION mask_phone(phone_number text)
RETURNS text AS $$
BEGIN
    IF phone_number IS NULL OR phone_number = '' THEN
        RETURN NULL;
    END IF;
    
    -- Mask phone: show last 4 digits only
    RETURN '***-***-' || RIGHT(regexp_replace(phone_number, '[^0-9]', '', 'g'), 4);
END;
$$ LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER;

-- 6. Create a secure view for leads summary with masked data
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

-- Grant SELECT access to authenticated users on the secure view
GRANT SELECT ON leads_secure_summary TO authenticated;

-- 7. Add RLS policy to the secure view (inherits from base table policies)
ALTER VIEW leads_secure_summary SET (security_barrier = true);

-- 8. Create function to validate agent assignment
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply the validation trigger
DROP TRIGGER IF EXISTS validate_lead_assignment ON "Leads_Table_Agents_Name";
CREATE TRIGGER validate_lead_assignment 
  BEFORE INSERT OR UPDATE ON "Leads_Table_Agents_Name"
  FOR EACH ROW EXECUTE FUNCTION validate_agent_assignment();