-- Fix remaining security function search path issue

-- Update the audit_sensitive_changes function to include proper search_path
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;