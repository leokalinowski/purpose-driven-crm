

# Remove Global Template Fallback — Event-Specific Templates Only

## What's Changing

All four email edge functions still query `global_email_templates` as a fallback when no event-specific template is found. This is being removed so the system uses **only** event-specific templates from `event_email_templates`. If one doesn't exist, the function returns an error instead of silently using something else.

## Files Modified

### 1. `supabase/functions/send-event-invitation/index.ts` (lines 185-206)
- Remove the global template lookup block
- Keep the error response when no template is found, update message to: `"No invitation template found for this event. Please create one in the Email Templates editor."`

### 2. `supabase/functions/rsvp-confirmation-email/index.ts` (lines 183-196)
- Remove the global template lookup block
- The existing error response at line 198 already handles the "no template" case

### 3. `supabase/functions/event-email-scheduler/index.ts` (lines 107-121)
- Remove the global template lookup from the `resolveTemplate` function
- If no event-specific template exists, return `null` immediately (the scheduler already skips and logs `no_template`)

### 4. `supabase/functions/event-reminder-email/index.ts` (lines 164-183)
- Remove both the global template lookup AND the hardcoded fallback that still exists here
- If no event-specific template is found, skip sending and return a clear error

All four functions will be redeployed after changes.

