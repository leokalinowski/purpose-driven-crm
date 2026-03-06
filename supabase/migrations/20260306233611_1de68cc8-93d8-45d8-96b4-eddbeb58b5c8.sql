CREATE OR REPLACE FUNCTION public.validate_invited_signup()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_has_invite boolean;
BEGIN
  -- Allow GoTrue admin API (used by edge functions via service role key)
  -- GoTrue connects as supabase_auth_admin, not via PostgREST JWT
  IF session_user = 'supabase_auth_admin' THEN
    RETURN NEW;
  END IF;

  -- Also check PostgREST service-role context (belt-and-suspenders)
  IF current_setting('request.jwt.claims', true)::json->>'role' = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Require a valid invitation for regular signups
  SELECT EXISTS (
    SELECT 1
    FROM public.invitations i
    WHERE lower(i.email) = lower(NEW.email)
      AND i.used = false
      AND i.expires_at > now()
  ) INTO v_has_invite;

  IF NOT v_has_invite THEN
    RAISE EXCEPTION 'Invite required for signup';
  END IF;

  RETURN NEW;
END;
$function$;