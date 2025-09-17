-- Security fix: Remove critical vulnerabilities (simplified version)

-- 1. Fix Leads_Table_Agents_Name table - Handle NULL assigned_agent_id
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
            
            RAISE NOTICE 'Updated % leads with NULL assigned_agent_id to admin: %', null_count, admin_user_id;
        ELSE
            RAISE NOTICE 'No admin user found. % leads with NULL assigned_agent_id remain unassigned.', null_count;
        END IF;
    END IF;
END $$;

-- 2. Add audit logging for sensitive operations
CREATE TABLE IF NOT EXISTS security_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  table_name text NOT NULL,
  operation text NOT NULL,
  old_values jsonb,
  new_values jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;

-- Create policy for audit log access (only admins)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'security_audit_log' 
        AND policyname = 'Only admins can view audit logs'
    ) THEN
        CREATE POLICY "Only admins can view audit logs" 
        ON security_audit_log FOR SELECT 
        USING (get_current_user_role() = 'admin');
    END IF;
END $$;

-- Create audit trigger function for sensitive tables
CREATE OR REPLACE FUNCTION audit_sensitive_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Log changes to sensitive tables containing PII
  IF TG_TABLE_NAME IN ('Leads_Table_Agents_Name', 'contacts', 'social_accounts') THEN
    INSERT INTO security_audit_log (
      user_id, table_name, operation, old_values, new_values
    ) VALUES (
      auth.uid(), 
      TG_TABLE_NAME, 
      TG_OP,
      CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN row_to_json(OLD) ELSE NULL END,
      CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add audit triggers to sensitive tables (drop existing first to avoid conflicts)
DROP TRIGGER IF EXISTS audit_leads_changes ON "Leads_Table_Agents_Name";
CREATE TRIGGER audit_leads_changes 
  AFTER INSERT OR UPDATE OR DELETE ON "Leads_Table_Agents_Name"
  FOR EACH ROW EXECUTE FUNCTION audit_sensitive_changes();

DROP TRIGGER IF EXISTS audit_contacts_changes ON contacts;
CREATE TRIGGER audit_contacts_changes 
  AFTER INSERT OR UPDATE OR DELETE ON contacts
  FOR EACH ROW EXECUTE FUNCTION audit_sensitive_changes();

DROP TRIGGER IF EXISTS audit_social_accounts_changes ON social_accounts;
CREATE TRIGGER audit_social_accounts_changes 
  AFTER INSERT OR UPDATE OR DELETE ON social_accounts
  FOR EACH ROW EXECUTE FUNCTION audit_sensitive_changes();

-- 3. Create a security function to check data access patterns
CREATE OR REPLACE FUNCTION check_suspicious_access()
RETURNS TRIGGER AS $$
DECLARE
    recent_access_count integer;
BEGIN
    -- Count recent access attempts by this user
    SELECT COUNT(*) INTO recent_access_count
    FROM security_audit_log
    WHERE user_id = auth.uid()
    AND table_name = TG_TABLE_NAME
    AND created_at > now() - interval '1 minute';
    
    -- Log potential suspicious activity (more than 100 operations per minute)
    IF recent_access_count > 100 THEN
        INSERT INTO security_audit_log (
            user_id, table_name, operation, new_values
        ) VALUES (
            auth.uid(), 'SECURITY_ALERT', 'SUSPICIOUS_ACCESS',
            jsonb_build_object('access_count_per_minute', recent_access_count)
        );
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add suspicious access monitoring to sensitive tables
DROP TRIGGER IF EXISTS monitor_leads_access ON "Leads_Table_Agents_Name";
CREATE TRIGGER monitor_leads_access 
  AFTER SELECT ON "Leads_Table_Agents_Name"
  FOR EACH STATEMENT EXECUTE FUNCTION check_suspicious_access();

-- 4. Add data masking function for sensitive display
CREATE OR REPLACE FUNCTION mask_sensitive_data(
    data_type text,
    original_value text
) RETURNS text AS $$
BEGIN
    CASE data_type
        WHEN 'email' THEN
            IF original_value IS NULL THEN
                RETURN NULL;
            END IF;
            RETURN LEFT(SPLIT_PART(original_value, '@', 1), 2) || '***@' || 
                   SPLIT_PART(original_value, '@', 2);
        WHEN 'phone' THEN
            IF original_value IS NULL THEN
                RETURN NULL;
            END IF;
            RETURN '***-***-' || RIGHT(original_value, 4);
        WHEN 'name' THEN
            IF original_value IS NULL THEN
                RETURN NULL;
            END IF;
            RETURN LEFT(original_value, 1) || '***';
        ELSE
            RETURN original_value;
    END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;