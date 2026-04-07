

## Fix: DNC Flag Blocking Event Invitation Emails

### Problem

Pam has 79 contacts with emails, but 46 are marked `dnc = true`. The `send-event-invitation` edge function filters contacts with `.eq('dnc', false)`, so only 33 emails were sent. The DNC (Do Not Call) flag is a **phone compliance** flag — it should not prevent sending event invitation emails.

### Impact

This affects ALL agents, not just Pam. Any contact flagged DNC is silently excluded from event invitations, follow-ups, and any email that uses the same filter pattern.

### Fix

**File: `supabase/functions/send-event-invitation/index.ts`**

Remove `.eq('dnc', false)` from the contacts query on line 139. The initial invitation query (line 135-141) currently reads:

```typescript
.eq('agent_id', agentId)
.eq('dnc', false)          // ← REMOVE THIS LINE
.not('email', 'is', null)
```

Also remove the same filter from the follow-up contacts query on line 231:

```typescript
.eq('agent_id', agentId)
.eq('dnc', false)          // ← REMOVE THIS LINE
.in('email', targetEmails)
```

After fixing, redeploy the edge function.

### Prevention: Re-send Pam's Missing Invitations

After deploying the fix, Pam can click "Send Invitations" again for her event. The deduplication logic already skips contacts who received the email (lines 152-165), so only the 46 previously-excluded contacts will receive invitations this time.

### Verification

After deploying, query to confirm:
- Eligible contacts should jump from 33 to 79
- The 33 already-sent contacts will be correctly skipped

### Technical Details

- **1 file changed**: `supabase/functions/send-event-invitation/index.ts` (2 lines removed)
- **Risk**: Low — we're removing an incorrect filter. The DNC flag remains visible in the UI for phone call guidance per existing design (agents see DNC markers but can still email).
- **No migration needed**: No database changes required.

