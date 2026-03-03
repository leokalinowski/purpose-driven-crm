

## Plan: Phase Tabs + Wrapping Task Titles

### Problem
1. All tasks for this event have `phase = NULL` in the database, so they group under "Other" instead of Pre-Event / Event Day / Post-Event
2. Task titles are truncated (`truncate` CSS class) which clips long names and forces horizontal scrolling

### Changes

**1. Backfill null phases in the database**
Run a migration to set `phase = 'pre_event'` for all existing tasks where `phase IS NULL`. This ensures they appear under the correct tab. Going forward, `buildTaskInserts` already sets phases correctly.

**2. Replace collapsible phase sections with Tabs (`SelfManagedTaskDashboard.tsx`)**
Instead of the current collapsible `<button>` per phase, use a `<Tabs>` component with three tab triggers: Pre-Event, Event Day, Post-Event. Each tab content renders its filtered task list. This matches the user's request and is cleaner than accordion-style grouping.

**3. Remove `truncate` from task titles (`SelfManagedTaskDashboard.tsx`)**
Change `truncate` to `break-words` on the task name `<p>` element (line 293) so long titles wrap naturally instead of being clipped.

### Files

| File | Change |
|---|---|
| `src/components/events/SelfManagedTaskDashboard.tsx` | Replace collapsible phase groups with `Tabs`; remove `truncate` from task name |
| SQL migration | `UPDATE event_tasks SET phase = 'pre_event' WHERE phase IS NULL` |

