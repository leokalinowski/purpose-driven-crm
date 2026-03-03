

## Plan: Add Email Management Tab to the Events Page (All Tiers)

### Current State
- The `EmailManagement` component (template editor, send/schedule, metrics) is **only available in the Admin Events Management page** (`AdminEventsManagement.tsx`).
- Regular users (agents, managed, core) on `/events` can only see tasks, RSVPs, and an "Invite Database" button that sends immediately with no preview or editing.

### What Changes

**1. Add an "Emails" tab to the Events page (`src/pages/Events.tsx`)**
- Add a fourth tab alongside "My Event", "RSVPs", and "All Events" called "Emails".
- Render the existing `EmailManagement` component inside it, passing the current event's `id` and `title`.
- This gives all tiers access to: template editing, manual send for all email types (invitation, reminders, thank-you, no-show), and email metrics.

**2. Remove the standalone "Invite Database" card (`src/pages/Events.tsx`)**
- The "Invite Your Database" card with the immediate-send button (lines 132-149) becomes redundant since users can now send invitations from the Emails tab with full template preview.
- Remove the `handleSendInvitations` function and `sendingInvites` state.

### Files to Change

| File | Change |
|---|---|
| `src/pages/Events.tsx` | Add "Emails" tab with `EmailManagement` component; remove standalone invite card and related state |

No access-control or edge function changes needed — the `EmailManagement` component and underlying hooks/RLS already support agents managing templates for their own events.

