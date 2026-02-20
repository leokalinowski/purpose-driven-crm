

# Event Invitation Email System

## What This Builds

A new "Invitation" email type that lets agents (and admins) blast their entire contact database to invite people to an upcoming event. This is the missing top-of-funnel piece -- right now the system only emails people who already RSVPed.

## How It Works

1. **New email type: `invitation`** -- added to the existing 5 types (confirmation, 7-day, 1-day, thank you, no-show), making 6 total.

2. **Recipients**: All contacts in the agent's database where `dnc = false` and `email IS NOT NULL`. For admin-triggered sends, it pulls contacts for the event's `agent_id`.

3. **RSVP link**: Each invitation email includes a prominent "RSVP Now" button linking to the event's public page (`https://hub.realestateonpurpose.com/event/{slug}`).

4. **Template support**: Works with the existing 3-tier template system (event-specific, global, hardcoded fallback). The visual editor gets a 6th tab.

5. **Deduplication**: Tracks every invitation sent in `event_emails` so the same contact won't be emailed twice for the same event.

6. **Rate limiting**: Sends with a small delay between emails (200ms) to stay within Resend rate limits, similar to the newsletter system.

## Changes

### 1. Database Migration

Add `invitation` as a supported email type across the template and tracking tables. No schema changes needed -- the `email_type` columns are `text` type (not enums), so they already accept any string. We just need to ensure the UI and edge function support it.

### 2. New Edge Function: `send-event-invitation`

**File: `supabase/functions/send-event-invitation/index.ts`**

This function:
- Accepts `{ eventId: string }` in the request body
- Fetches the event details + agent profile (same pattern as reminder email)
- Fetches all contacts for the agent where `dnc = false` and `email IS NOT NULL`
- Checks `event_emails` to skip contacts already invited to this event
- Resolves the email template (event-specific -> global -> hardcoded fallback)
- Sends via Resend with rate limiting (200ms between emails)
- Logs each send to both `event_emails` (with `email_type = 'invitation'`) and `email_logs`
- Returns a summary: `{ sent: N, skipped: N, failed: N }`

The hardcoded fallback template includes:
- Agent-branded header with logo/headshot
- Event details (title, date, time, location)
- A prominent "RSVP Now" button linking to the public event page
- Agent contact info footer

### 3. Frontend: Add "Invitation" Tab to Email Management

**File: `src/components/events/email/EmailManagement.tsx`**

Add a 6th entry to `EMAIL_TYPES`:
```
{
  key: 'invitation',
  label: 'Event Invitation',
  icon: Send,
  description: 'Invite contacts from the agent database to RSVP'
}
```

Update the tab grid from `grid-cols-5` to `grid-cols-6`. Add `'invitation'` to the `canSendManually` list. Update the send handler to call `send-event-invitation` when the type is `invitation`.

### 4. Frontend: Update Type Definitions

**Files:**
- `src/hooks/useEmailTemplates.ts` -- add `'invitation'` to the `email_type` union type, add `sendInvitationEmails()` method
- `src/hooks/useGlobalEmailTemplates.ts` -- add `'invitation'` to the type union
- `src/components/events/email/EmailTemplateEditor.tsx` -- add `{rsvp_link}` as a new variable in the Variable Insert Bar
- `src/components/events/email/VisualEmailEditor.tsx` -- add `{rsvp_link}` variable support
- `src/components/events/email/VariableInsertBar.tsx` -- add the `{rsvp_link}` variable button

### 5. Agent-Side Access

**File: `src/pages/Events.tsx`**

Add an "Invite Database" button on the agent's My Event tab (next to the existing event dashboard). This button calls `send-event-invitation` for their event. A confirmation dialog warns them how many contacts will be emailed before sending.

### 6. Edge Function Config

**File: `supabase/config.toml`**

Add JWT verification disabled for the new function (we validate auth in code):
```toml
[functions.send-event-invitation]
verify_jwt = false
```

## Email Setup Summary (answering your questions)

| Question | Answer |
|---|---|
| What email address? | `noreply@realestateonpurpose.com` (via Resend). Reply-to is set to the agent's personal email. |
| How to "turn on" for an event? | The event must be **published** (has a `public_slug`). Then click "Send Now" on the Invitation tab. |
| Templates | Use the visual editor to customize the invitation template (global or per-event). |
| Who can send? | Both admins (from Admin Events Management) and agents (from their Events page). |

## Files to Create/Modify

| File | Action |
|---|---|
| `supabase/functions/send-event-invitation/index.ts` | Create -- new edge function |
| `supabase/config.toml` | Modify -- add function config |
| `src/components/events/email/EmailManagement.tsx` | Modify -- add invitation tab + send logic |
| `src/hooks/useEmailTemplates.ts` | Modify -- add invitation type + send method |
| `src/hooks/useGlobalEmailTemplates.ts` | Modify -- add invitation to type union |
| `src/components/events/email/VariableInsertBar.tsx` | Modify -- add `{rsvp_link}` variable |
| `src/components/events/email/EmailTemplateEditor.tsx` | Modify -- support invitation type preview |
| `src/pages/Events.tsx` | Modify -- add "Invite Database" button for agents |

