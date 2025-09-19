-- Patch log_sensitive_data_changes to be table-agnostic and not reference non-existent columns
CREATE OR REPLACE FUNCTION public.log_sensitive_data_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.security_audit_log (
    user_id, 
    table_name, 
    operation, 
    old_values, 
    new_values
  ) VALUES (
    auth.uid(), 
    TG_TABLE_NAME, 
    TG_OP,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;