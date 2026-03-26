

## Fix Kate's Two Issues: Walk-In Check-In Toggle + Tim's Thank-You Email Error

### Issue 1: Walk-ins should NOT auto-confirm as "checked in"

Kate wants to add Rashida's Eventbrite registrants as walk-ins who are **not checked in**, so they receive the no-show email. Currently `addWalkInAttendee` hardcodes `check_in_status: 'checked_in'`.

**Fix:** Add a "Mark as checked in" toggle (Switch) to the Walk-In dialog, defaulting to ON. When toggled OFF, the attendee is inserted with `check_in_status: 'not_checked_in'` and no `checked_in_at`. This lets Kate add people who registered elsewhere but didn't attend, making them eligible for no-show emails.

**Files:**
- `src/components/events/RSVPManagement.tsx` — Add a Switch to the walk-in dialog form; pass the toggle value to `addWalkInAttendee`
- `src/hooks/useRSVP.ts` — Update `addWalkInAttendee` to accept an optional `markCheckedIn` parameter (default `true`); conditionally set `check_in_status` and `checked_in_at`

### Issue 2: Tim's Thank-You emails still error

The `event-reminder-email` edge function was updated in code but likely **not redeployed**. The function needs to be deployed for the changes to take effect. Additionally, the function uses `SUPABASE_ANON_KEY` with the user's auth header — if the auth token expires or is missing, queries against RLS-protected tables (`event_email_templates`, `event_emails`) will fail silently.

**Fix:**
1. **Deploy** the updated `event-reminder-email` edge function
2. Also deploy the updated `manual-send-event-email` edge function
3. Improve error surfacing in `useEmailTemplates.ts` so the actual error message from the edge function is shown in the toast (currently it just says "There was an error sending the emails")

**Files:**
- Deploy `event-reminder-email` and `manual-send-event-email` edge functions
- `src/components/events/email/EmailManagement.tsx` — Show the actual error message from the response in the toast instead of a generic message

### Technical Details

**Walk-in toggle:**
- New state: `walkInCheckedIn: true` in the form state
- Switch component imported from `@/components/ui/switch`
- Dialog description updated to reflect the toggle behavior
- `addWalkInAttendee(eventId, formData, markCheckedIn)` signature change

**Email error surfacing:**
- In the catch block of `handleSendEmails`, extract `error.message` or `error.context?.body` for the toast
- The edge function already returns descriptive errors (e.g., "No thank_you template found for this event")

