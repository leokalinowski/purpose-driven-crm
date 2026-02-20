

# Fix: Allow Retry of Failed/Bounced Invitation Emails

## Problem

When you click "Send Now" again, the deduplication logic in `send-event-invitation` fetches ALL `event_emails` rows for the event -- including ones with `failed` or `bounced` status. This means the 86 failed contacts are treated as "already invited" and skipped entirely.

## Fix

### `supabase/functions/send-event-invitation/index.ts` (lines 97-106)

Update the dedup query to only skip contacts with successful statuses. Change the query from:

```
.eq('event_id', eventId)
.eq('email_type', 'invitation')
```

to:

```
.eq('event_id', eventId)
.eq('email_type', 'invitation')
.in('status', ['sent', 'delivered', 'opened', 'clicked'])
```

This way, contacts whose previous send `failed` or `bounced` will be picked up on retry.

Additionally, before inserting a new `event_emails` row for a retried contact, delete or update the old failed row to avoid duplicates piling up. The simplest approach: delete the old failed row first, then insert fresh.

### Summary

| Item | Detail |
|---|---|
| File | `supabase/functions/send-event-invitation/index.ts` |
| Change | Filter dedup query to only skip successful statuses; clean up old failed rows on retry |
| Redeploy | Yes |
| Retry | Click "Send Now" again after deploy -- the 86 failed contacts will be retried with rate limiting |

