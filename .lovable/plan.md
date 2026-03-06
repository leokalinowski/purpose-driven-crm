

## Fix: RSVP RLS Violation on Public Submissions

### Root Cause

In `useRSVP.ts`, the RSVP insert uses `.insert([{...}]).select().single()`. PostgreSQL treats `INSERT ... RETURNING` (which `.select()` triggers) as requiring **both** INSERT and SELECT RLS policies to pass. 

The INSERT policy passes (event is published), but the only SELECT policy on `event_rsvps` requires `auth.uid() = event.agent_id OR admin` — which anonymous RSVP submitters can never satisfy. This causes the "new row violates row-level security" error.

### Fix

Create a `SECURITY DEFINER` RPC function `submit_public_rsvp` that handles the insert server-side (bypassing RLS) and returns the new RSVP ID and status. Then update `useRSVP.ts` to call this RPC instead of doing a direct `.insert().select()`.

### Step 1: Database Migration

Create function `submit_public_rsvp(p_event_id, p_email, p_name, p_phone, p_guest_count)`:
- Verifies event exists and is published
- Checks for duplicate RSVP (reuses existing logic)
- Determines status based on capacity (confirmed vs waitlist)
- Inserts the row and returns `id` and `status`
- SECURITY DEFINER so it bypasses RLS

### Step 2: Update `src/hooks/useRSVP.ts`

Replace the two direct `.insert().select().single()` calls (one for waitlist, one for confirmed) with a single call to the new `submit_public_rsvp` RPC. This eliminates the SELECT policy requirement for anonymous users entirely.

### Files Changed

| File | Change |
|------|--------|
| Migration SQL | Create `submit_public_rsvp` function |
| `src/hooks/useRSVP.ts` | Replace direct inserts with RPC call |

