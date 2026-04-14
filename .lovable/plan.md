

## Plan: Fix 4 Security Issues

### Fix 1 — `.gitignore`: Add env file patterns

Append these lines to the bottom of `.gitignore`:

```
.env
.env.local
.env.production
.env.*.local
```

**File changed:** `.gitignore`

---

### Fix 2 — `src/integrations/supabase/client.ts`: Use env vars + runtime guard

Replace the entire file with:

```ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error(
    'Missing Supabase environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must be set'
  );
}

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
```

**File changed:** `src/integrations/supabase/client.ts`

---

### Fix 3 — Invitations table RLS: Add 4 granular admin policies

Create a new migration that replaces the existing broad policy with four explicit per-operation policies:

```sql
-- Drop existing broad policy
DROP POLICY IF EXISTS "Admins can manage all invitations" ON public.invitations;

-- SELECT
CREATE POLICY "Admins can select invitations"
  ON public.invitations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- INSERT
CREATE POLICY "Admins can insert invitations"
  ON public.invitations FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- UPDATE
CREATE POLICY "Admins can update invitations"
  ON public.invitations FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- DELETE
CREATE POLICY "Admins can delete invitations"
  ON public.invitations FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
```

**File changed:** New migration file in `supabase/migrations/`

After the migration runs, mark `invitations_table_no_select_policy` as fixed in the security scan.

---

### Fix 4 — automation_settings: Ignore the security finding

Mark the `automation_settings_no_agent_select` finding (scanner: `supabase_lov`) as intentionally ignored with explanation: "Admin-only access is by design. No frontend code reads this table as a non-admin user. The ALL policy restricted to admin role is the intended access pattern."

No code or migration changes needed.

---

### Summary

| # | What | Files / Assets |
|---|------|---------------|
| 1 | Add env patterns to `.gitignore` | `.gitignore` |
| 2 | Env vars + runtime guard | `src/integrations/supabase/client.ts` |
| 3 | 4 granular RLS policies on `invitations` | New migration |
| 4 | Ignore `automation_settings` finding | Security scan update only |

