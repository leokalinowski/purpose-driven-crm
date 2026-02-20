
# Remove Global Template Toggle + Set Up Automated Email Triggers

## Part 1: Remove the Global Template Mode

Right now the Email Management page has a "Global / Event-Specific" toggle. You want only Event-Specific templates. Changes:

**`src/components/events/email/EmailManagement.tsx`**
- Remove the `templateMode` state variable and the Global/Event-Specific toggle buttons
- Always render `<EmailTemplateEditor>` (event-specific), never `<GlobalTemplateEditor>`
- Remove the `Globe`, `FileText` icon imports
- Remove the import of `GlobalTemplateEditor`
- Show the "Send Now" button always (no longer gated by `templateMode === 'event'`)

The `GlobalTemplateEditor.tsx` file and `useGlobalEmailTemplates.ts` hook stay in the codebase since the edge function still uses global templates as a fallback layer -- we just remove the UI for editing them.

## Part 2: Answering Your Automation Question

**Currently, none of the event emails are automated.** There are no cron jobs set up. Every email type (reminders, thank you, no-show) only fires when someone clicks "Send Now."

Here is what we need to set up so emails fire automatically:

| Email Type | Trigger | How |
|---|---|---|
| Invitation | Manual "Send Now" click | Already works (no change needed) |
| RSVP Confirmation | Automatic on RSVP submission | Already works via `rsvp-confirmation-email` |
| 7-Day Reminder | 7 days before event | Needs a daily cron job |
| 1-Day Reminder | 1 day before event | Same daily cron job |
| Thank You | Day after event (to attendees) | Same daily cron job |
| No-Show | Day after event (to no-shows) | Same daily cron job |

To automate the 4 scheduled types, we need:

1. **New edge function: `event-email-scheduler`** -- A single function that runs daily, queries all published events, and determines which emails to send based on the event date vs. today. It calls the existing `event-reminder-email` function logic internally.

2. **A pg_cron job** -- Runs the scheduler once daily (e.g., 10:00 AM UTC / 6:00 AM ET). This requires running a SQL statement in the Supabase dashboard.

### New Edge Function: `event-email-scheduler`

This function will:
- Query all published events
- For each event, check the date relative to today:
  - If event is exactly 7 days away: send `reminder_7day` to all RSVPs who haven't received it
  - If event is exactly 1 day away: send `reminder_1day` to all RSVPs who haven't received it
  - If event was yesterday: send `thank_you` to checked-in attendees, `no_show` to others
- Uses the same template resolution (event-specific, then global fallback, then hardcoded)
- Logs everything to `event_emails` with deduplication (skips if already sent)
- Returns a summary of what was sent

### Cron Job (SQL to run in Supabase dashboard)

After deploying, you'll run this SQL once in the Supabase SQL Editor to schedule the daily run. I'll provide the exact SQL with your project URL and anon key.

## Technical Details

### Files to modify
| File | Change |
|---|---|
| `src/components/events/email/EmailManagement.tsx` | Remove Global toggle, always show Event-Specific |
| `supabase/functions/event-email-scheduler/index.ts` | New -- daily scheduler that auto-sends reminders/thank-you/no-show |
| `supabase/config.toml` | Add config for new function |

### Scheduler Logic (pseudocode)
```text
For each published event:
  daysUntilEvent = eventDate - today

  if daysUntilEvent == 7:
    send reminder_7day to all RSVPs not yet emailed
  if daysUntilEvent == 1:
    send reminder_1day to all RSVPs not yet emailed
  if daysUntilEvent == -1:
    send thank_you to RSVPs with check_in_status = 'checked_in'
    send no_show to RSVPs with check_in_status = 'not_checked_in'
```

Each send checks `event_emails` first to avoid duplicates, exactly like the invitation system does.
