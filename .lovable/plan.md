

## Fix DNC Checks, Improve Database Reliability, and Add Admin-Only Controls

### Problem Summary

You're experiencing three distinct issues:

1. **DNC checks fail with "Failed to send a request to the Edge Function"** - The `dnc-monthly-check` edge function uses deprecated import patterns (`serve` from `deno.land/std`) causing deployment/invocation failures
2. **Contact creation fails for agents** - Generic "Failed to add contact" error suggests RLS or authentication edge cases
3. **DNC buttons are visible to all users** - They should be admin-only

---

### Root Cause Analysis

**Issue 1: DNC Edge Function Failures**

The `dnc-monthly-check` function at `supabase/functions/dnc-monthly-check/index.ts` uses:
- Deprecated `serve` import from `https://deno.land/std@0.168.0/http/server.ts`
- Old-style `esm.sh` imports for Supabase client

These patterns cause bundle timeouts and deployment issues. The newer edge functions (`get-ticket-comments`, `post-ticket-comment`) were already fixed to use `npm:` specifiers and `Deno.serve()`.

**Issue 2: Contact Creation Reliability**

The `useContacts` hook (line 152-172) lacks detailed error logging, making it hard to diagnose failures. Additionally:
- No retry logic for transient failures
- No session validation before insert attempts

**Issue 3: DNC UI Visibility**

The Database page (`src/pages/Database.tsx`) shows DNC buttons to all authenticated users (lines 468-486). There's no role check before rendering these buttons.

---

### Solution

#### Part 1: Fix DNC Edge Function (Critical)

**File: `supabase/functions/dnc-monthly-check/index.ts`**

Update imports and server pattern to match working edge functions:

```typescript
// BEFORE (broken):
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

serve(async (req) => { ... });

// AFTER (working):
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => { ... });
```

This matches the pattern used successfully in the recently-fixed `get-ticket-comments` and `post-ticket-comment` functions.

---

#### Part 2: Hide DNC UI for Non-Admins

**File: `src/pages/Database.tsx`**

Add role check and conditionally render DNC section:

```typescript
// Add import
import { useUserRole } from '@/hooks/useUserRole';

// Inside component
const { isAdmin, loading: roleLoading } = useUserRole();

// Wrap DNC section in conditional render
{isAdmin && (
  <Card>
    <CardHeader>
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <DNCCheckButton ... />
          <DNCCheckButton ... forceRecheck={true} />
        </div>
      </div>
    </CardHeader>
    <CardContent>
      <DNCStatsCard ... />
    </CardContent>
  </Card>
)}
```

This ensures only admins see DNC buttons and stats on the regular Database page.

---

#### Part 3: Improve Contact Creation Reliability

**File: `src/hooks/useContacts.ts`**

Enhance `addContact` function with:
- Better error logging for diagnosis
- Session validation before insert
- More informative error messages

```typescript
const addContact = async (contactData: ContactInput) => {
  // Validate session
  if (!user || !effectiveAgentId) {
    console.error('[addContact] No user authenticated', { user: !!user, effectiveAgentId });
    throw new Error('User not authenticated. Please refresh and try again.');
  }

  console.log('[addContact] Inserting contact:', {
    agent_id: effectiveAgentId,
    last_name: contactData.last_name,
  });

  const { data, error } = await supabase
    .from('contacts')
    .insert([
      {
        ...contactData,
        agent_id: effectiveAgentId,
        category: contactData.last_name.charAt(0).toUpperCase() || 'A',
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('[addContact] Insert failed:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    throw error;
  }

  console.log('[addContact] Success:', { id: data?.id });
  fetchContacts();
  return data;
};
```

---

#### Part 4: Add DNC Check Progress Indicator

**File: `src/pages/Database.tsx`**

Add visual progress during DNC checks:

```typescript
// Show progress toast when DNC check is running
{dncChecking && (
  <Alert className="border-blue-500 bg-blue-50">
    <RefreshCw className="h-4 w-4 animate-spin" />
    <AlertDescription>
      DNC check in progress. Stats will update automatically when complete.
    </AlertDescription>
  </Alert>
)}
```

---

### Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/dnc-monthly-check/index.ts` | Update imports to `npm:` specifiers, use `Deno.serve()` |
| `src/pages/Database.tsx` | Add `useUserRole` hook, wrap DNC section in `{isAdmin && ...}` |
| `src/hooks/useContacts.ts` | Add detailed logging to `addContact` function |
| `src/pages/AdminDatabaseManagement.tsx` | DNC buttons already present, verify they work correctly after edge function fix |

---

### Technical Details

**Why the edge function was failing:**

The `serve` function from `deno.land/std` has been deprecated in favor of `Deno.serve()`. Additionally, `esm.sh` imports can cause bundle timeout issues. Using `npm:` specifiers resolves this as demonstrated by the successful deployment of `get-ticket-comments` and `post-ticket-comment`.

**RLS Policies (Verified Working):**

The existing RLS policies for contacts are correctly configured:
- `"Agents can insert their own contacts"` uses `WITH CHECK ((agent_id = auth.uid()) OR (get_current_user_role() = 'admin'))`
- This should allow agents to insert contacts where `agent_id` matches their `auth.uid()`

The contact insertion errors are likely caused by edge function communication issues or session state problems, which the improved logging will help diagnose.

**DNC Logs Policy:**

The `dnc_logs` table has proper policies:
- `"Admins can manage dnc logs"` - admin can INSERT
- `"Agents can view their own dnc logs"` - agents can only SELECT

The edge function uses the service role key to insert logs, so this should work. The issue is the function itself failing to deploy/execute.

---

### Expected Outcome

After these changes:
- DNC checks will work reliably from Admin Database Management
- Agents will no longer see DNC buttons on the regular Database page
- Contact creation failures will produce diagnostic logs for further debugging
- The system will show visual progress during DNC operations

