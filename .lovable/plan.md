

# Fix: Rate-Limited Emails in Send Invitations

## Problem

All 86 "failed" emails share the same error: **Resend rate limit exceeded (2 requests/second)**. The `send-event-invitation` function sends emails in a tight loop with zero delay, so it blows past the limit after the first batch gets through.

None of these are actual bounces -- the emails never even left Resend. The 86 contacts just need to be retried.

## Fix

### 1. Add rate-limiting delay in `supabase/functions/send-event-invitation/index.ts`

Add a 600ms delay between each email send (well within the 2 req/sec limit). This matches the pattern already used by the newsletter sender.

Insert a simple `await new Promise(resolve => setTimeout(resolve, 600))` after each Resend API call inside the contact loop.

### 2. Retry the 86 failed contacts

After deploying the fix, the "Send Now" button already has deduplication logic -- it skips contacts who already received an invitation successfully. So clicking "Send Now" again will automatically pick up only the 86 that failed and send them with proper pacing.

No data cleanup needed -- the existing dedup check (lines 98-110) queries `event_emails` for `status = 'sent'` only, so failed records won't block a retry.

## Technical Details

| Item | Detail |
|---|---|
| File modified | `supabase/functions/send-event-invitation/index.ts` |
| Change | Add `await new Promise(r => setTimeout(r, 600))` after each send |
| Redeploy | Yes, function will be redeployed |
| Retry method | Click "Send Now" again after deploy -- dedup logic handles it automatically |

