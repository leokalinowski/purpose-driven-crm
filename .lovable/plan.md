

## Problem

Tasks **are being created** successfully (32 tasks exist in `event_tasks` for Leonardo's "Test" event). The issue is that the UI never shows them.

In `EventProgressDashboard.tsx` line 22:
```typescript
const useClickUp = isAdmin || isAgent || isEditor;
```

Leonardo has an `admin` role, so `useClickUp = true`. This routes to the ClickUp read-only view, which queries the `clickup_tasks` table (empty for this event). The self-managed `event_tasks` are never displayed.

## Root Cause

The dashboard routing logic assumes admins always use ClickUp-synced tasks. But when an admin creates an event through the normal flow (not via `addEventAsAdmin` with ClickUp folder provisioning), tasks go into `event_tasks`, not `clickup_tasks`.

## Fix

**File: `src/components/events/EventProgressDashboard.tsx`**

Change the routing logic to be data-driven rather than role-driven:
1. Check if the event has any `clickup_tasks` rows.
2. If yes, show the ClickUp read-only view.
3. If no, show the `SelfManagedTaskDashboard` regardless of user role.

This is a one-line logic change:

```typescript
// Before:
const useClickUp = isAdmin || isAgent || isEditor;

// After:
const useClickUp = (isAdmin || isAgent || isEditor) && tasks.length > 0;
```

The `tasks` variable already holds the ClickUp tasks fetched by `useClickUpTasks(event.id)` on line 25. If there are no ClickUp tasks, fall through to the self-managed dashboard where the `event_tasks` data will display correctly.

This also addresses the note from the previous plan about adding a fallback when ClickUp mode has zero tasks configured.

### Files to change
| File | Change |
|---|---|
| `src/components/events/EventProgressDashboard.tsx` | Update routing condition (1 line) |

