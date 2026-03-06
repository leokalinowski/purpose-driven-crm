

## Plan: Fix validate_invited_signup Trigger for GoTrue Context

### Root Cause
The migration we applied checks `current_setting('request.jwt.claims', true)->>'role'` for `'service_role'`. This works for PostgREST calls but **not** for GoTrue admin API calls (`auth.admin.createUser`). GoTrue connects to Postgres as the `supabase_auth_admin` database role, and does not set `request.jwt.claims`.

### Fix
Update the `validate_invited_signup()` function to also check `session_user` for the GoTrue admin role:

```sql
-- Allow GoTrue admin API (used by edge functions via service role)
IF session_user = 'supabase_auth_admin' THEN
  RETURN NEW;
END IF;
```

This single line addition (replacing or supplementing the JWT claims check) will correctly bypass the invite requirement when the stripe-webhook calls `auth.admin.createUser()`.

### Changes
- **Database migration**: Update `validate_invited_signup()` to detect the `supabase_auth_admin` session user, which is what GoTrue uses for all admin API operations.

No edge function changes needed -- the webhook code is correct; only the trigger detection logic was wrong.

