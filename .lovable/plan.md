

## Plan: Add Status Workflow + Replace Default Checklist

### Problem 1: No Status Transitions
Users can only toggle tasks between "pending" and "completed." There's no way to set a task to "In Progress" -- a critical workflow step for tracking real event prep.

### Problem 2: Default Checklist Mismatch
The generated checklist (`defaultEventTasks.ts`) contains generic placeholder tasks, not your actual pre-event workflow. There's also a stale second task list hardcoded in `useEvents.ts` (lines 6-34).

### Implementation

**1. Add status selector to task rows in `SelfManagedTaskDashboard.tsx`**

Replace the binary circle/checkmark toggle with a small dropdown or segmented control offering three statuses:
- **To Do** (value: `pending`) -- circle icon
- **In Progress** (value: `in_progress`) -- clock icon, highlighted
- **Done** (value: `completed`) -- green checkmark, sets `completed_at`

Clicking the status cycles through: pending → in_progress → completed → pending. Or use a small dropdown for explicit selection.

**2. Add status field to `TaskEditForm.tsx`**

Add a Status dropdown (To Do / In Progress / Done) in the edit dialog so users can also change status while editing other fields.

**3. Replace default checklist in `defaultEventTasks.ts`**

Replace the 22 generic tasks with your actual 32 pre-event tasks (provided above), using appropriate `days_offset` values spread across the typical ~60-day prep window. Keep event_day and post_event phases as separate sections (to be defined later or kept minimal).

**4. Remove stale hardcoded task list from `useEvents.ts`**

Delete lines 6-34 (the "Safe & Warm" `EVENT_TASK_TEMPLATES` array) which is unused dead code now that `defaultEventTasks.ts` exists.

**5. Update stats calculation**

Update the stats in `SelfManagedTaskDashboard` to count `in_progress` tasks separately (currently only counts `completed` and `overdue`). Add an "In Progress" stat card to `EventProgressStats`.

### Files to Modify

| File | Action |
|---|---|
| `src/components/events/SelfManagedTaskDashboard.tsx` | Add status cycling/dropdown on task rows, update stats for in_progress |
| `src/components/events/TaskEditForm.tsx` | Add Status dropdown field |
| `src/utils/defaultEventTasks.ts` | Replace with actual 32 pre-event tasks |
| `src/hooks/useEvents.ts` | Remove dead `EVENT_TASK_TEMPLATES` array (lines 6-34) |
| `src/components/events/EventProgressStats.tsx` | Add "In Progress" stat card |

