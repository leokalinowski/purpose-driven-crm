
## Diagnosis: why Timothy’s email send is still failing

The failure is real, and the main issue was not fully fixed.

### What the logs show
The deployed `event-reminder-email` function is still throwing:

```text
Error sending reminder emails: Error: Event not found
```

That means the function is failing before it even gets to the thank-you / no-show recipient filtering.

### Why this is happening

1. **The function still uses the wrong auth/data-access pattern**
   - `event-reminder-email` is still built around a single client created with the anon key plus whatever `Authorization` header happens to come in.
   - If that header is missing, stale, or not usable in this context, the function falls back to anon-level access.
   - Anon access can only see **published** events, so admin-triggered sends for unpublished/admin-managed events will fail with “Event not found”.

2. **The event lookup is still using a fragile nested relation query**
   - The function does:
     - `from('events').select('*, profiles:agent_id (...)')`
   - But elsewhere in the app, event/profile data is intentionally fetched in **separate queries** “to avoid relationship query issues”.
   - So the send function is still using a query pattern the frontend already avoids. If that relation fails, the code turns it into the misleading generic error “Event not found”.

3. **The earlier “fix” did not address the real failing path**
   - The prior work did improve:
     - thank-you / no-show filtering logic
     - walk-in check-in handling
   - But it **did not harden the actual event fetch + auth path** inside `event-reminder-email`.
   - Also, `EmailManagement` sends directly to `event-reminder-email`; the `manual-send-event-email` function is not the main path used by the button Timothy/Kate are hitting.

4. **The error message is still too generic**
   - The function throws `new Error('Event not found')` for any event query failure.
   - So if the true problem is:
     - auth context missing
     - relation query failure
     - RLS denial
   - the UI still only gets a vague message.

## What has not actually been fixed yet

- The edge function still does **not** use the safer two-client pattern:
  - user-context client to validate access
  - service-role client to fetch/send/log reliably
- The function still uses the risky embedded `profiles:agent_id (...)` event query.
- The current implementation still masks the real root error as “Event not found”.
- The admin send flow was not made robust for unpublished events or flaky auth headers.

## Plan to fix it properly

### 1. Rebuild `event-reminder-email` auth flow
Update the function so it uses:
- a **user-context client** to verify the caller is allowed to send for that event
- a **service-role client** for the actual event/template/RSVP/email-log operations

This removes dependence on the browser token for the operational queries while still keeping permission checks secure.

### 2. Replace the fragile event query
Stop using the nested `profiles:agent_id (...)` relation in the edge function.

Instead:
- fetch the event first
- then fetch the agent profile separately
- then fetch marketing settings separately

That matches the safer pattern already used in the frontend.

### 3. Return real diagnostics instead of “Event not found”
Change the function to distinguish:
- event truly missing
- caller not authorized
- relation/query failure
- template missing
- RSVP fetch failure

This will make admin troubleshooting much faster and prevent false “fixed” claims.

### 4. Verify the admin email path specifically
Review both places that render `EmailManagement`:
- `src/pages/Events.tsx`
- `src/pages/AdminEventsManagement.tsx`

Then make sure the send flow works the same when triggered from admin-managed events, especially unpublished ones.

### 5. Tighten UI error surfacing
Improve the email hook/UI layer so the toast shows the returned API error body consistently, not just a generic function error object.

### 6. Keep the existing thank-you / no-show filtering
Retain the already-added attendance filtering:
- `thank_you` → checked-in only
- `no_show` → not checked-in

But move it onto the service-role query path so it actually runs reliably.

## Files to update

- `supabase/functions/event-reminder-email/index.ts`
  - main auth/data-access rewrite
  - separate event/profile/settings queries
  - better error reporting

- `src/hooks/useEmailTemplates.ts`
  - normalize edge-function errors before throwing

- `src/components/events/email/EmailManagement.tsx`
  - keep/improve explicit user-facing error display

## Expected outcome

After this fix:
- admins will be able to send Timothy’s emails reliably
- unpublished/admin-managed events will no longer fail just because the function fell back to anon access
- the function will fail with the **real cause**, not a misleading “Event not found”
- the previously added thank-you/no-show logic will finally sit on a stable send path

## Bottom line

The problem is not that thank-you logic is too complex.  
The problem is that the function’s **foundation** is still wrong:
- wrong auth pattern
- brittle event query
- misleading error handling

That is why it still fails even though part of the earlier work was technically changed.
