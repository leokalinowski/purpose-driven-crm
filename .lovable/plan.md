

## Fix: Failed Emails Block Retries

### Problem

Two issues are causing Timothy's thank-you emails to permanently fail:

1. **Dedup check doesn't distinguish failed from sent**: When the function sends an email and it fails (e.g., Resend rejects it), it inserts a record into `event_emails` with `status: 'failed'`. On retry, the dedup check (line 289-295) looks for ANY existing record matching `event_id + rsvp_id + email_type` — it does NOT filter by status. So it finds the failed record and skips the retry, reporting "already sent."

2. **Unknown Resend rejection reason**: The emails failed on the first attempt (likely domain verification or rate limiting), got recorded as failed, and now can never be retried.

### Fix

#### 1. Update dedup check to only skip successfully sent emails (`event-reminder-email/index.ts`)

Change the existing dedup query from:
```
.eq('event_id', eventId).eq('rsvp_id', rsvp.id).eq('email_type', emailType)
```
to:
```
.eq('event_id', eventId).eq('rsvp_id', rsvp.id).eq('email_type', emailType).eq('status', 'sent')
```

This way, failed records don't block retries. Only successfully sent emails are skipped.

#### 2. Delete old failed records before retrying

When a retry succeeds, delete the old failed record so the tracking table stays clean. Add a cleanup step: before inserting a new `sent` record, delete any prior `failed` records for the same `event_id + rsvp_id + email_type`.

#### 3. Deploy and verify

- Deploy the updated edge function
- Check the logs for the actual Resend error to confirm the sender domain fix from the last deploy is active
- Test sending thank-you emails again

### Files to update

- `supabase/functions/event-reminder-email/index.ts` — fix dedup query, add failed-record cleanup

### Expected outcome

After this fix, clicking "Send Thank You" again will retry all 8 failed recipients instead of skipping them. Successfully sent emails will still be properly deduplicated on future retries.

