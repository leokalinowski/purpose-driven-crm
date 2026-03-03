

## Events Tab Audit: Bugs, Inconsistencies & Improvements

### Bugs

**1. Realtime subscription is unfiltered — every user receives every event change**
In `useEvents.ts` (line 471), the realtime channel listens to `postgres_changes` on the `events` table with no filter (`filter: 'agent_id=eq.${user.id}'`). Every insert/update/delete on the `events` table triggers a full `fetchEvents()` for every connected user, even if the change belongs to a different agent. Same issue for `event_tasks` (line 474). This causes unnecessary network traffic and potential UI flicker.

**2. `EventProgressStats` "In Progress" calculation is wrong for ClickUp view**
In `EventProgressStats.tsx` (line 10), when `inProgress` is not provided, it falls back to `stats.total - stats.completed - stats.overdue`. This double-counts tasks that are both incomplete and overdue — overdue tasks are a subset of incomplete tasks, so this produces a negative or understated "In Progress" count.

**3. Console debug logs left in EventForm**
`EventForm.tsx` lines 258-271 contain two `console.log('SAVING EVENT WITH:' ...)` and `console.log('Updating event with date/time:' ...)` statements that should be removed for production.

**4. `useEvents` realtime doesn't filter by user — triggers reload for all agents' changes**
As noted in #1, but worth emphasizing: the realtime channel on `event_tasks` has no `filter` clause, so any task update (even by admin on another agent's event) triggers a full task refetch for all connected users.

**5. RSVPManagement passes `maxCapacity={undefined}` always**
In `RSVPManagement.tsx` line 188, `maxCapacity` is hardcoded to `undefined`. The event's `max_capacity` is never passed down from the parent (`Events.tsx` doesn't pass it, and `RSVPManagement` doesn't accept it as a prop). Users never see the capacity bar in the RSVP stats even when the event has a max capacity set.

**6. TaskEditForm `due_date` set to `null` when cleared creates a database error**
In `TaskEditForm.tsx` line 62, `due_date: dueDate ? dueDate.toISOString().split('T')[0] : null` — if `due_date` column is NOT NULL in the DB, this will fail. Even if it allows NULL, this inconsistency with `TaskForm.tsx` (which sends `undefined`) can cause confusing behavior.

### Inconsistencies

**7. Mixed toast libraries (still present)**
- `SelfManagedTaskDashboard.tsx`, `TaskEditForm.tsx`: use `sonner` (`toast.success`, `toast.error`)
- `TaskForm.tsx`, `EventForm.tsx`, `EmailTemplateEditor.tsx`, `EmailManagement.tsx`: use `useToast` from `@/hooks/use-toast`
- `RSVPManagement.tsx`: uses `sonner`

This creates inconsistent toast styling across the same module.

**8. Duplicate hero card rendering between EventProgressDashboard and SelfManagedTaskDashboard**
Both components render nearly identical hero progress cards (event title, date, days countdown, progress bar). The ClickUp view in `EventProgressDashboard` and the self-managed view in `SelfManagedTaskDashboard` duplicate ~40 lines of identical UI code. Should be extracted to a shared component.

**9. "In Progress" stat calculation differs between ClickUp and self-managed views**
- `SelfManagedTaskDashboard` (line 62): counts tasks with `status === 'in_progress'` explicitly
- `EventProgressStats` (line 10): calculates as `total - completed - overdue` (incorrect, as noted in #2)

These will show different numbers for the same data depending on which view is active.

**10. Date formatting still inconsistent**
- `Events.tsx` uses `format(date, 'MMM d, yyyy')` via `formatEventDate`
- `SelfManagedTaskDashboard` uses `format(date, 'EEEE, MMMM d, yyyy')` for the hero
- `RSVPManagement` uses `format(date, 'MMM d, yyyy')` and `'MMM d, yyyy h:mm a'`
- Task due dates use `format(date, 'MMM d')` (no year)

**11. RSVP sub-tabs `grid-cols-5` is not mobile-responsive**
`RSVPManagement.tsx` line 203 uses `grid w-full grid-cols-5` for the inner tabs. On mobile (320-414px), five columns will be extremely cramped with truncated labels.

### Improvement Opportunities

**12. Pass `max_capacity` to RSVPManagement**
The `activeEvent` object already contains `max_capacity`. Pass it as a prop to `RSVPManagement` so the capacity progress bar in `RSVPStats` actually renders.

**13. Add realtime filters to reduce unnecessary refetches**
Add `filter: 'agent_id=eq.${user.id}'` to both realtime subscriptions in `useEvents.ts` to only react to the current user's data changes.

**14. Extract shared event hero card**
The hero progress card (title, date, countdown, progress bar) is duplicated between `EventProgressDashboard` and `SelfManagedTaskDashboard`. Extract to a `EventHeroCard` component.

**15. Add event name to Emails/RSVPs tab headers**
When viewing the Emails or RSVPs tab, there's no indication of which event is currently selected. Adding the event title as a subtitle would reduce confusion.

### Recommended Priority

| Priority | Item | Impact |
|---|---|---|
| High | #1/#4 — Unfiltered realtime subscriptions | Performance: every user refetches on any change |
| High | #2/#9 — In Progress stat calculation wrong | Displays incorrect data to ClickUp-tier users |
| High | #5/#12 — maxCapacity never passed to RSVPStats | Capacity bar never shown despite data existing |
| Medium | #7 — Mixed toast libraries | Inconsistent UX across the module |
| Medium | #11 — RSVP sub-tabs not mobile-responsive | Unusable on small screens |
| Low | #3 — Console.log left in EventForm | Code cleanliness |
| Low | #8/#14 — Duplicate hero card code | Maintainability |
| Low | #10 — Date format inconsistency | Visual polish |

