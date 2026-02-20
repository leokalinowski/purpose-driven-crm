

# Update Event Email Sender Address and Display Name

## What's Changing

All event-related emails currently send from `report@market.realestateonpurpose.com` with the name "Real Estate on Purpose - Market Report". We're switching them to:

- **From address**: `noreply@events.realestateonpurpose.com`
- **Display name**: `{Agent's Full Name} - Events` (e.g., "Samir Kamara - Events")

The newsletter/market report emails will continue using `report@market.realestateonpurpose.com` -- this change only affects event emails.

## Pre-requisite: Verify the subdomain in Resend

Before any code changes take effect, the `events.realestateonpurpose.com` subdomain must be added and verified in Resend:

1. Go to [Resend Domains](https://resend.com/domains)
2. Add `events.realestateonpurpose.com`
3. Add the DNS records Resend provides (MX, SPF, DKIM)
4. Wait for verification to complete

If the existing Resend API key is scoped to all domains, it will work automatically. If it's scoped to a specific domain, a new key or updated scope will be needed.

## Code Changes

### 1. `supabase/functions/send-event-invitation/index.ts`

Currently (line 267):
```
from: `${Deno.env.get('RESEND_FROM_NAME') || 'Real Estate on Purpose'} <${Deno.env.get('RESEND_FROM_EMAIL') || 'noreply@realestateonpurpose.com'}>`
```

Change to use the agent's name and the events subdomain:
```
from: `${agentName} - Events <noreply@events.realestateonpurpose.com>`
```

The `agentName` variable already exists in this function (built from `event.profiles.first_name` and `last_name`).

### 2. `supabase/functions/event-email-scheduler/index.ts`

Currently (line 183):
```
from: `${Deno.env.get('RESEND_FROM_NAME') || 'Real Estate on Purpose'} <${Deno.env.get('RESEND_FROM_EMAIL') || 'noreply@realestateonpurpose.com'}>`
```

Change to use the agent's name from the event's profile data:
```
from: `${agentName} - Events <noreply@events.realestateonpurpose.com>`
```

The agent name is already available in this function from the event's joined profile data.

### 3. `supabase/functions/rsvp-confirmation-email/index.ts`

Currently uses `FROM_EMAIL` and `FROM_NAME` from the shared secrets. Change the `from` field in the Resend send call to:
```
from: `${agentName} - Events <noreply@events.realestateonpurpose.com>`
```

The agent profile is already fetched in this function via the event's `agent_id`.

### 4. `supabase/functions/send-email/index.ts` (no change)

This is the generic email function. It should keep using the shared `RESEND_FROM_EMAIL` / `RESEND_FROM_NAME` secrets since it handles all email types (newsletters, system emails, etc.). Event-specific functions above will bypass it with their own sender.

## What Stays the Same

- Newsletter emails continue from `report@market.realestateonpurpose.com`
- System invitation emails (account signup) continue from `invitations@realestateonpurpose.com`
- No new secrets needed -- the events subdomain is hardcoded in the event functions since it's specific to this use case
- No database changes needed

## Files Modified

| File | Change |
|---|---|
| `supabase/functions/send-event-invitation/index.ts` | Hardcode `noreply@events.realestateonpurpose.com` and use agent name |
| `supabase/functions/event-email-scheduler/index.ts` | Hardcode `noreply@events.realestateonpurpose.com` and use agent name |
| `supabase/functions/rsvp-confirmation-email/index.ts` | Hardcode `noreply@events.realestateonpurpose.com` and use agent name |
