

## Plan: Event Invitation Follow-Up Emails

### Concept

Add the ability to send follow-up invitations to contacts who were invited but haven't RSVP'd. The existing `send-event-invitation` function already tracks who was sent an invite — a follow-up system filters those recipients against the RSVP list and re-sends with a different template.

### Approach

**New email types**: Add `invitation_followup_1` and `invitation_followup_2` to the system, giving agents up to 3 total invitation touches (initial + 2 follow-ups).

**How it works**:
1. Agent sends initial invitation (existing flow)
2. Agent clicks "Send Follow-Up #1" — system identifies contacts who received the invite but have NOT RSVP'd, sends them a follow-up email using a dedicated template
3. Agent clicks "Send Follow-Up #2" — same logic, different template, only targets contacts not yet RSVP'd

Each follow-up has its own template so the messaging can escalate urgency (e.g., "Just a reminder..." → "Last chance to RSVP!").

### Changes

| Area | Change |
|------|--------|
| **Email type enum** | Add `invitation_followup_1` and `invitation_followup_2` to the `email_type` values accepted by templates and email logs |
| **Edge function** | Create `send-event-invitation-followup` (or extend existing function with a `followup_number` parameter) that queries contacts who were invited but haven't RSVP'd |
| **EmailTemplateEditor UI** | Add the two new follow-up types to the template type dropdown so agents can create/customize follow-up templates |
| **EmailManagement UI** | Add "Send Follow-Up #1" and "Send Follow-Up #2" buttons that appear after the initial invitation has been sent, with recipient count preview showing how many non-RSVP'd contacts will receive it |
| **VisualEmailEditor defaults** | Provide conversion-optimized default content for follow-ups (e.g., "We saved you a spot!" / "Last chance to RSVP!") |
| **useEmailTemplates hook** | Add `sendFollowUpEmails(eventId, followupNumber)` method |

### Follow-Up Logic (Edge Function)

```text
1. Fetch all contacts who received invitation email (status: sent/delivered/opened/clicked)
2. Fetch all confirmed RSVPs for this event
3. Subtract RSVP'd contacts → remaining = follow-up targets
4. Also subtract contacts who already received THIS specific follow-up
5. Send follow-up template to remaining contacts
```

### UI Flow

In the Emails tab, the invitation section would show:

```text
┌─────────────────────────────────────┐
│ Invitations                         │
│ ✅ Initial: 150 sent                │
│ 📧 Follow-Up #1: Send (132 pending)│
│ 📧 Follow-Up #2: Not yet available │
│    (available after Follow-Up #1)   │
└─────────────────────────────────────┘
```

Follow-Up #2 only unlocks after #1 has been sent, preventing agents from accidentally blasting all three at once.

### Files to Create/Modify

- `supabase/functions/send-event-invitation/index.ts` — add `followup_number` parameter support
- `src/hooks/useEmailTemplates.ts` — add follow-up send method
- `src/components/events/email/EmailTemplateEditor.tsx` — add follow-up types to dropdown
- `src/components/events/email/EmailManagement.tsx` — add follow-up send buttons with recipient counts
- `src/components/events/email/VisualEmailEditor.tsx` — add default content for follow-up types

No database migration needed — the `email_type` columns are text fields, not enums, so new type values work without schema changes.

