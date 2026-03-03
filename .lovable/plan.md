

## Events Tab Audit: Bugs, Inconsistencies & Improvements

### Bugs

**1. Duplicate `return` statement in EventForm.tsx (line 49)**
The time-parsing initializer has two consecutive `return time;` statements (lines 48-49). The second is dead code. Harmless but sloppy.

**2. Console: "Lock was stolen by another request" errors**
The `useUserRole` RPC call is being aborted repeatedly, causing the role to resolve as `null`. When role is `null`, `useFeatureAccess.hasAccess('/events')` returns `false` (since `getTierLevel(null)` returns 99), which triggers the **UpgradePrompt** even for users who should have access. This is visible in the session replay — a user named "Leo Kalinowski" sees the upgrade prompt despite likely having access. The root cause is that Supabase's `GoTrueClient` lock contention aborts in-flight requests during rapid re-renders (e.g., HMR or multiple tabs). The fix is to add retry logic or an `AbortController` guard in `useUserRole`.

**3. `getNextEvent()` returns `undefined` when all events are past**
If a user has only past events, `getNextEvent()` returns `undefined`, so the "My Event" tab shows the empty state ("No Upcoming Events") even though they have events. The Emails and RSVPs tabs then also show empty states because they depend on `nextEvent?.id` as a fallback. Users must manually select an event from "All Events" first, but there's no obvious UI cue to do so.

**4. `selectedEventId` doesn't propagate to the "My Event" tab**
When a user clicks an event in "All Events", `selectedEventId` is set, but the "My Event" tab always renders `nextEvent`, ignoring `selectedEventId`. Only the Emails and RSVPs tabs use `selectedEventId || nextEvent?.id`.

**5. Email metrics RLS blocks non-admin agents**
The `event_emails` table has a SELECT policy for agents (`Agents can view emails for their events`), but the `email_logs` table (used in admin email log views) is admin-only. The `EmailMetricsDashboard` uses `event_emails` which is correctly scoped, so this works. However, sending emails via `sendInvitationEmails` etc. invokes edge functions that run with the service role, which is fine. No blocking bug here, but worth confirming.

**6. No delete confirmation dialog**
Task deletion in `SelfManagedTaskDashboard` (line 378) calls `handleDelete` immediately with no confirmation — a single misclick permanently deletes a task. Event deletion uses `confirm()` (native browser dialog) which is inconsistent with the rest of the UI.

### Inconsistencies

**7. Mixed toast libraries**
`RSVPManagement` uses `sonner` (`toast.error`, `toast.success`), while `EmailManagement` and `EventForm` use `useToast` from `@/hooks/use-toast`. The entire Events module should pick one.

**8. "View RSVPs" button in All Events tab is misleading**
Clicking "View RSVPs" on an event in the All Events tab sets `selectedEventId` but doesn't navigate the user to the RSVPs tab. The button toggles text to "Hide RSVPs" but nothing visually changes on the All Events tab itself. It only affects the RSVPs/Emails tabs when you switch to them.

**9. Event date display inconsistency**
- All Events tab: `toLocaleDateString()` (locale-dependent, no time)
- EventProgressDashboard: `format(date, 'EEEE, MMMM d, yyyy')` (date-fns, no time)
- RSVPManagement: `format(date, 'MMM d, yyyy')` or `'MMM d, yyyy h:mm a'`
- No consistent date/time format across the module.

**10. Tab count information missing**
The RSVPs tab in the main Events page shows no count of RSVPs. The Email tab shows no count of templates or emails sent. Only the inner RSVPManagement component shows counts.

### Improvement Opportunities

**11. "My Event" should show the most recent event when no upcoming events exist**
Fall back to the most recent past event (using the existing `getPreviousQuarterEvent()`) instead of showing an empty state.

**12. Event selection should be persistent across tabs**
Selecting an event in "All Events" should update all tabs (My Event, Emails, RSVPs) to show that event's data, not just Emails/RSVPs.

**13. Mobile responsiveness of RSVP tabs**
The RSVPManagement inner tabs use `grid-cols-5` which will be cramped on mobile. The main Events page tabs handle this with `overflow-x-auto` but the RSVP sub-tabs don't.

**14. No way to select a different event from the Emails/RSVPs tabs**
If a user has multiple events, they must go to "All Events" to switch. An event selector dropdown at the top of Emails/RSVPs tabs would be more intuitive (the `EmailManagement` component already supports this when no `eventId` is provided, but it's overridden by the parent passing one).

### Recommended Priority

| Priority | Item | Impact |
|---|---|---|
| High | #2 — Role fetch abort/retry | Users locked out of features they have access to |
| High | #3/#4 — Event fallback + selection sync | Users with past-only events see empty dashboards |
| Medium | #6 — Delete confirmation | Data loss risk from misclicks |
| Medium | #8 — "View RSVPs" should switch tab | Confusing UX, button does nothing visible |
| Low | #1 — Dead code cleanup | Code quality |
| Low | #7 — Toast library consistency | Developer experience |
| Low | #9 — Date format consistency | Visual polish |

