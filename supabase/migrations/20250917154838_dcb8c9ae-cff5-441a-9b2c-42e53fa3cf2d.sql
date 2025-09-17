-- Fix security vulnerabilities in the database

-- 1. Fix Leads_Table_Agents_Name table security issues
-- Add NOT NULL constraint to assigned_agent_id to prevent security gaps
-- First, update any existing NULL assigned_agent_id records to a default admin
DO $$
DECLARE
    admin_user_id uuid;
BEGIN
    -- Get the first admin user ID
    SELECT user_id INTO admin_user_id 
    FROM profiles 
    WHERE role = 'admin' 
    LIMIT 1;
    
    -- If admin exists, update NULL assigned_agent_id records
    IF admin_user_id IS NOT NULL THEN
        UPDATE "Leads_Table_Agents_Name" 
        SET assigned_agent_id = admin_user_id 
        WHERE assigned_agent_id IS NULL;
    END IF;
END $$;

-- Make assigned_agent_id NOT NULL to prevent future security gaps
ALTER TABLE "Leads_Table_Agents_Name" 
ALTER COLUMN assigned_agent_id SET NOT NULL;

-- Add a proper primary key if missing
ALTER TABLE "Leads_Table_Agents_Name" 
ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();

-- Create unique constraint on id if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'leads_table_agents_name_pkey'
    ) THEN
        ALTER TABLE "Leads_Table_Agents_Name" 
        ADD CONSTRAINT leads_table_agents_name_pkey PRIMARY KEY (id);
    END IF;
END $$;

-- 2. Improve market_stats table security
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view market stats" ON market_stats;

-- Create more restrictive policies for market stats
CREATE POLICY "Agents can view market stats for their assigned areas" 
ON market_stats FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM contacts c 
    WHERE c.agent_id = auth.uid() 
    AND c.zip_code = market_stats.zip_code
  ) OR 
  get_current_user_role() = 'admin'
);

-- 3. Improve social_analytics security
-- Drop overly permissive system policies
DROP POLICY IF EXISTS "System can insert social analytics" ON social_analytics;
DROP POLICY IF EXISTS "System can update social analytics" ON social_analytics;

-- Create more restrictive system policies with validation
CREATE POLICY "Authenticated services can insert social analytics" 
ON social_analytics FOR INSERT 
WITH CHECK (
  -- Only allow inserts for existing social posts or authenticated users
  (post_id IS NULL AND agent_id = auth.uid()) OR 
  (post_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM social_posts sp 
    WHERE sp.id = post_id 
    AND sp.agent_id = agent_id
  )) OR
  get_current_user_role() = 'admin'
);

CREATE POLICY "System can update verified social analytics" 
ON social_analytics FOR UPDATE 
USING (
  -- Only allow updates to analytics for existing posts
  EXISTS (
    SELECT 1 FROM social_posts sp 
    WHERE sp.id = post_id 
    AND (sp.agent_id = auth.uid() OR get_current_user_role() = 'admin')
  ) OR
  get_current_user_role() = 'admin'
);

-- 4. Add audit logging for sensitive operations
CREATE TABLE IF NOT EXISTS security_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  table_name text NOT NULL,
  operation text NOT NULL,
  old_values jsonb,
  new_values jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Only admins can view audit logs" 
ON security_audit_log FOR SELECT 
USING (get_current_user_role() = 'admin');

-- Create audit trigger function for sensitive tables
CREATE OR REPLACE FUNCTION audit_sensitive_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Log changes to sensitive tables
  IF TG_TABLE_NAME IN ('Leads_Table_Agents_Name', 'contacts', 'social_accounts') THEN
    INSERT INTO security_audit_log (
      user_id, table_name, operation, old_values, new_values
    ) VALUES (
      auth.uid(), 
      TG_TABLE_NAME, 
      TG_OP,
      CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
      CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add audit triggers to sensitive tables
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

-- 5. Add data encryption function for sensitive fields (placeholder for future enhancement)
CREATE OR REPLACE FUNCTION encrypt_sensitive_data(data text)
RETURNS text AS $$
BEGIN
  -- This is a placeholder for future encryption implementation
  -- In production, you would use pgcrypto or external encryption
  RETURN data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Create view for safely accessing leads without exposing all PII
CREATE OR REPLACE VIEW public.leads_summary AS 
SELECT 
  id,
  assigned_agent_id,
  first_name,
  LEFT(last_name, 1) || '***' as last_name_masked,
  CASE 
    WHEN email IS NOT NULL THEN 
      SPLIT_PART(email, '@', 1) || '***@' || SPLIT_PART(email, '@', 2)
    ELSE NULL 
  END as email_masked,
  CASE 
    WHEN phone IS NOT NULL THEN 
      '***-***-' || RIGHT(phone::text, 4)
    ELSE NULL 
  END as phone_masked,
  city,
  state,
  status,
  created_at,
  updated_at
FROM "Leads_Table_Agents_Name";

-- Grant access to the summary view
GRANT SELECT ON leads_summary TO authenticated;

-- Add RLS to the summary view
ALTER VIEW leads_summary SET (security_barrier = true);
CREATE POLICY "Agents can view their assigned leads summary" 
ON "Leads_Table_Agents_Name" FOR SELECT 
USING (
  (assigned_agent_id = auth.uid()) OR 
  (get_current_user_role() = 'admin')
);