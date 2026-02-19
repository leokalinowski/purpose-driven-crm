
# Rename "ClickUp Tasks" to "Checklist" + Auto-Sync + Remove Buttons

## Changes

### 1. Rename all user-facing "ClickUp Tasks" labels to "Checklist"

| File | Before | After |
|---|---|---|
| `AdminEventsManagement.tsx` (sub-tab) | "ClickUp Tasks" | "Checklist" |
| `AdminEventTasks.tsx` (card title) | "ClickUp Tasks (N)" | "Checklist (N)" |
| `AdminEventTasks.tsx` (empty state) | "No tasks found. Click ..." | "No checklist items found." |
| `EventProgressDashboard.tsx` (empty state heading) | "No ClickUp Tasks Synced" | "No Checklist Items Yet" |
| `EventProgressDashboard.tsx` (empty state body) | "...link this event to ClickUp and sync tasks" | "...no checklist items for this event yet" |

### 2. Remove "Link Events to ClickUp" and "Sync Tasks" buttons
From `AdminEventTasks.tsx`:
- Delete the `handleLinkEvents` function, `linking` state, and the Link button
- Delete the `handleSync` function, `syncing` state, and the Sync button
- Delete the `linkResult` state and the Link Results card
- Remove unused imports (`Link2`, `RefreshCw`)

### 3. Add Supabase Realtime subscription for auto-updates
The ClickUp webhook already writes changes to the `clickup_tasks` table in real time. We just need to subscribe to those changes so the UI updates automatically.

In `AdminEventTasks.tsx`, add a `useEffect` that subscribes to Postgres changes on `clickup_tasks` filtered by `event_id` (when a single event is selected). On any INSERT/UPDATE/DELETE, call `fetchTasks()` to refresh the data.

```typescript
useEffect(() => {
  if (eventFilter === 'all') return;
  
  const channel = supabase
    .channel(`checklist-${eventFilter}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'clickup_tasks',
      filter: `event_id=eq.${eventFilter}`,
    }, () => fetchTasks())
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, [eventFilter]);
```

This means whenever ClickUp sends a webhook and the task row is updated, the checklist will refresh automatically -- no manual sync needed.

### Files Modified
- `src/components/admin/AdminEventTasks.tsx` -- major cleanup (remove buttons, add realtime, rename labels)
- `src/pages/AdminEventsManagement.tsx` -- rename sub-tab label
- `src/components/events/EventProgressDashboard.tsx` -- rename empty state text
