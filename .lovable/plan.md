

## Plan: Tier-Based Event Task Management

### Current State
- **Agent/Admin tier**: Events use ClickUp-synced tasks (`clickup_tasks` table) displayed via `EventProgressDashboard` → `useClickUpTasks` → `EventTaskList`. These are read-only in the Hub (managed by the REOP team in ClickUp).
- **All tiers**: A separate self-managed task system already exists using the `event_tasks` table with full CRUD (`useEvents.addTask/updateTask/markTaskComplete/deleteTask`) and UI components (`TaskManagement`, `TaskForm`, `TaskEditForm`). However, this is **not connected** to the `EventProgressDashboard`.
- **Managed/Core tiers**: Currently see the ClickUp-based dashboard, which shows "No Checklist Items Yet" since they have no ClickUp tasks.

### What to Build

Make `EventProgressDashboard` tier-aware: Agent/Admin tiers see the existing ClickUp task view; Managed/Core tiers see a self-service task management experience using the `event_tasks` table, pre-populated with a default checklist template.

### Implementation

**1. Default Task Template for New Events**

When a Managed or Core user creates an event, auto-generate a starter task list in `event_tasks` based on the same three-phase structure (Pre-Event, Event Day, Post-Event). This will be a utility function that creates ~15-20 common event preparation tasks with relative due dates calculated from the event date.

Example tasks: "Finalize guest list" (Pre-Event, -14 days), "Confirm venue" (Pre-Event, -7 days), "Print name tags" (Event Day, -1 day), "Send thank you emails" (Post-Event, +2 days), etc.

**2. Modify `EventProgressDashboard` to be tier-aware**

- Import `useUserRole` to check the current user's tier
- **Agent/Admin**: Continue using `useClickUpTasks` (existing behavior, read-only view)
- **Managed/Core**: Use `event_tasks` from `useEvents` instead, showing the same progress stats UI but with full inline editing capabilities (mark complete, edit, delete, add new tasks)

**3. Enhance the self-managed task UI**

Integrate the existing `TaskManagement` capabilities directly into the progress dashboard for lower tiers:
- Add inline task completion toggle (click to mark done/undo)
- Add inline due date editing
- Add notes/comments field per task
- Show the same progress stats cards (total, completed, overdue, progress %)
- Show phase grouping using a `phase` column -- add this to the `event_tasks` table schema

**4. Schema Change: Add `phase` column to `event_tasks`**

Add a `phase` text column (values: `pre_event`, `event_day`, `post_event`) to `event_tasks` so self-managed tasks can use the same phase-based progress breakdown that ClickUp tasks show.

**5. Wire into Events page**

No changes needed to the `Events.tsx` page itself -- it already renders `EventProgressDashboard` for the next event. The dashboard component will internally switch behavior based on tier.

### Files to Create/Modify

| File | Action |
|---|---|
| `src/utils/defaultEventTasks.ts` | **Create** -- default task template with phase + relative due dates |
| `src/components/events/EventProgressDashboard.tsx` | **Modify** -- add tier check, branch between ClickUp and self-managed views |
| `src/components/events/SelfManagedTaskDashboard.tsx` | **Create** -- new component for Managed/Core task management with inline editing, progress stats, and phase grouping |
| `src/hooks/useEvents.ts` | **Modify** -- add `generateDefaultTasks(eventId, eventDate)` function that creates starter tasks |
| `src/components/events/TaskForm.tsx` | **Modify** -- add phase selector dropdown |
| `src/components/events/TaskEditForm.tsx` | **Modify** -- add phase selector dropdown |
| Migration | **Create** -- add `phase` column to `event_tasks` table |

