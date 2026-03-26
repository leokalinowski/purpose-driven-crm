
Root cause is now clear: the thank-you flow is failing for delivery reasons, not because the event can’t be found.

### What’s actually broken
1. `event-reminder-email` sends from:
   - `Real Estate on Purpose <noreply@realestateonpurpose.com>`
2. Recent function logs show Resend rejecting that sender:
   - `The realestateonpurpose.com domain is not verified`
3. The function also sends all thank-you emails in parallel with `Promise.all(...)`, which is triggering:
   - `Too many requests. You can only make 5 requests per second`

So there are two backend issues still present:
- wrong/unverified sender domain for this function
- no rate limiting / retry strategy for bulk sends

### What I will change
1. **Fix the sender identity in `event-reminder-email`**
   - Stop hardcoding `noreply@realestateonpurpose.com`
   - Use the same verified event sender pattern already used elsewhere:
     - `noreply@events.realestateonpurpose.com`
   - Keep branding as “Real Estate on Purpose” or “Agent Name - Events” consistently with the existing event email system

2. **Add safe rate limiting to thank-you / no-show / reminder sends**
   - Replace the `Promise.all(...)` blast with sequential sending or small-batch sending
   - Add a delay between sends, matching the safer invitation-email pattern already in the codebase
   - This should eliminate the current Resend 429 errors

3. **Improve result handling so partial failures are obvious**
   - Return a response that clearly reports:
     - sent
     - skipped
     - failed
     - first failure reason
   - Make the UI show the actual provider error instead of the generic “Failed to send thank-you emails”

4. **Standardize event email sending paths**
   - Align `event-reminder-email` with the stronger conventions already used by:
     - `send-event-invitation`
     - RSVP confirmation emails
   - This reduces inconsistent behavior between invitation emails and post-event emails

### Important inconsistency I found
The event system currently uses two different sender domains:
- invitations / RSVP confirmations: `noreply@events.realestateonpurpose.com`
- thank-you / reminder emails: `noreply@realestateonpurpose.com`

That mismatch is the main reason this specific send path still fails.

### Files to update
- `supabase/functions/event-reminder-email/index.ts`
  - fix sender domain
  - replace parallel blasting with throttled sending
  - improve error payloads
- `src/hooks/useEmailTemplates.ts`
  - preserve detailed backend/provider errors
- `src/components/events/email/EmailManagement.tsx`
  - show clearer failure messages for partial and full send failures

### Expected outcome
After this fix:
- Timothy’s thank-you emails should send from the verified events sender
- bulk sends should stop failing from Resend rate-limit bursts
- if anything still fails, the UI should show the real reason immediately instead of a vague generic message

### Technical details
```text
Current failure chain:
UI -> event-reminder-email
   -> fetch RSVPs OK
   -> template OK
   -> send from unverified root domain -> provider reject
   -> send all at once -> rate limit on some recipients
   -> UI sometimes collapses result to generic failure text

Planned fix:
UI -> event-reminder-email
   -> fetch RSVPs OK
   -> template OK
   -> send from verified events subdomain
   -> throttle sends
   -> return detailed summary
   -> UI displays exact reason
```
