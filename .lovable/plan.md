

## Plan: Automated Follow-Up Scheduling

### Concept

Add a per-event setting that lets agents enable automatic follow-up invitations. When enabled, the existing `event-email-scheduler` cron job (runs daily at 10 AM ET) will check if X days have passed since the initial invitation was sent and automatically trigger follow-ups to non-RSVP'd contacts.

### Database Changes

**Migration**: Add columns to `events` table for follow-up scheduling settings:

```sql
ALTER TABLE public.events
  ADD COLUMN auto_followup_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN followup_1_days integer NOT NULL DEFAULT 3,
  ADD COLUMN followup_2_days integer NOT NULL DEFAULT 7;
```

No new tables needed — the existing `event_emails` table already tracks which follow-up emails have been sent, and the `send-event-invitation` function already handles the follow-up filtering logic.

### Edge Function Changes

**`event-email-scheduler/index.ts`** — Add automated follow-up logic alongside the existing reminder/thank-you/no-show scheduling:

1. For each published event with `auto_followup_enabled = true`:
   - Find the earliest `invitation` email `sent_at` date for that event
   - If today is `followup_1_days` days after initial send AND `invitation_followup_1` hasn't been sent yet → invoke `send-event-invitation` with `followupNumber: 1`
   - If today is `followup_2_days` days after initial send AND `invitation_followup_2` hasn't been sent yet → invoke `send-event-invitation` with `followupNumber: 2`
   - Only send if the event date is still in the future (no follow-ups after the event)

The scheduler will call `send-event-invitation` internally via `fetch()` to reuse all existing follow-up filtering logic (dedup, RSVP exclusion, template resolution).

### UI Changes

**`EmailManagement.tsx`** — Add an "Auto Follow-Up Settings" card in the invitation section:

- Toggle: "Enable Automatic Follow-Ups"
- Two number inputs: "Follow-Up #1 after X days" (default 3) and "Follow-Up #2 after X days" (default 7)
- Save button that updates the `events` table
- Status indicators showing if each follow-up has already been sent automatically
- Note: templates must exist for the follow-up types before enabling

### Files to Modify

| File | Change |
|------|--------|
| Migration SQL | Add `auto_followup_enabled`, `followup_1_days`, `followup_2_days` to `events` |
| `supabase/functions/event-email-scheduler/index.ts` | Add follow-up scheduling logic after existing reminder logic |
| `src/components/events/email/EmailManagement.tsx` | Add auto follow-up settings UI card |

