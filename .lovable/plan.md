

## Plan: Fix Invite-Required Trigger Blocking Webhook User Creation

### Root Cause

The `validate_invited_signup()` trigger on `auth.users` fires on EVERY insert, including `auth.admin.createUser()` calls from the service role. When a new customer completes Stripe checkout with an email like `leo_kalinowski@hotmail.com`, the webhook tries to create a Supabase user but the trigger rejects it because there's no matching invitation record.

Auth log evidence:
```
ERROR: Invite required for signup (SQLSTATE P0001)
```

### Fix

Modify the `validate_invited_signup()` trigger function to **skip validation when the caller is the service role**. The service role is used by trusted backend code (like the stripe-webhook), so it should bypass the invitation check.

#### Database Migration

Update the `validate_invited_signup` function to detect service-role context and skip the invite check:

```sql
CREATE OR REPLACE FUNCTION public.validate_invited_signup()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_has_invite boolean;
  v_role text;
BEGIN
  -- Allow service-role (admin API) calls to bypass invite check
  -- This enables the stripe-webhook to provision accounts for paying customers
  v_role := current_setting('request.jwt.claims', true)::json->>'role';
  IF v_role = 'service_role' THEN
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
```

This is the only change needed. No edge function code changes required -- the webhook logic is already correct; it was just being blocked by this trigger.

### Verification

After applying the migration, send another test checkout from Stripe. The webhook should:
1. Successfully create the user account
2. Create a profile row
3. Assign the `core` role
4. Send the welcome/password-set email via Resend

