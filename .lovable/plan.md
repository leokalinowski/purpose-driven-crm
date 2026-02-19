

# Events Tracking System -- ClickUp Integration for Agents

## Overview
Transform the agent-facing Events page from a simple RSVP viewer into a full **Events Tracking Dashboard** that pulls live task progress from ClickUp, similar to how the Support Hub pulls ticket data from ClickUp. Agents will see a visual breakdown of how their event preparation is going, powered by the `clickup_tasks` table that already syncs via the `clickup-webhook` edge function.

## Current State

**What exists today:**
- The `clickup_tasks` table stores tasks synced from ClickUp (task name, status, due date, responsible person, completed_at), linked to events via `event_id`
- The `clickup-webhook` edge function receives real-time updates from ClickUp and upserts into `clickup_tasks`
- The `clickup-register-and-sync` edge function does an initial bulk sync of tasks tagged "event" from a ClickUp list
- Events have a `clickup_list_id` field to link to their ClickUp list
- The agent Events page currently only shows an event timeline list and RSVP management -- no task tracking
- There's also a local `event_tasks` table for manually created tasks, but it's disconnected from ClickUp

**What's missing:**
- Agents cannot see their ClickUp tasks at all on the Events page
- No progress visualization (progress bars, countdown, task breakdown)
- No way for admins to assign tasks to specific agents from the Hub
- The `clickup_tasks` table has no `agent_id` column -- tasks are linked to events but not directly to agents

## What We're Building

### 1. Database Changes

**Add `agent_id` column to `clickup_tasks`:**
- New nullable `agent_id` (uuid) column on `clickup_tasks`
- This allows tasks to be mapped to specific agents, not just events
- Update RLS: agents can SELECT where `agent_id = auth.uid()` OR via the existing event-based policy

**Add RLS policy for agent access:**
- Agents can view `clickup_tasks` where their `agent_id` matches directly (not just through event ownership)

### 2. New Edge Function: `clickup-sync-event-tasks`
A dedicated function that admins can trigger (or runs on a schedule) to:
1. For each event with a `clickup_list_id`, fetch all tasks from that ClickUp list
2. Match ClickUp assignees to Hub agents by comparing assignee email/username to `profiles` table
3. Upsert into `clickup_tasks` with the resolved `agent_id`
4. Return a summary of what was synced

This also updates the existing `clickup-webhook` to resolve `agent_id` from ClickUp assignee data when processing real-time updates.

### 3. New Component: `EventProgressDashboard`
The main new component agents see on their Events page, replacing the current flat timeline. For the agent's next upcoming event, it shows:

**Progress Header Card:**
- Event title, date, days until event countdown
- Overall progress bar (completed tasks / total tasks)
- Quick stats: X of Y tasks done, Z overdue, W due this week

**Task Breakdown by Category:**
- Group tasks by responsible_person or by status
- Visual progress per group (e.g., "Marketing: 4/6 done", "Venue: 2/3 done")
- Color-coded status indicators (green = done, yellow = in progress, red = overdue)

**Task List (Collapsible):**
- All tasks in a sortable, filterable list
- Each task shows: name, status badge, due date, responsible person
- Overdue tasks highlighted in red
- Completed tasks shown with checkmark and strikethrough

**Timeline/Milestone View:**
- Visual timeline showing tasks plotted against the event date
- Highlights upcoming deadlines in the next 7 days

### 4. Redesigned Agent Events Page (`/events`)
Replace the current page layout with a tabbed approach:

| Tab | Content |
|-----|---------|
| **My Event** | EventProgressDashboard for next upcoming event (the hero view) |
| **RSVPs** | Existing RSVPManagement component |
| **All Events** | Existing event timeline list (past + future) |

The "My Event" tab is the default, giving agents an immediate snapshot of where they stand.

### 5. New Component: `EventsWidget` (Dashboard Home)
A compact widget for the agent's main dashboard (like the existing `SupportWidget`), showing:
- Next event name and date
- Mini progress bar (X/Y tasks done)
- Number of overdue tasks (with warning icon if any)
- "View Details" link to `/events`

### 6. Admin: Assign Tasks to Agents
On the Admin Events Management page (`/admin/events`), add a new tab "ClickUp Tasks" that shows:
- All synced ClickUp tasks across all events
- Ability to manually assign/reassign `agent_id` on any task
- A "Sync Now" button that triggers `clickup-sync-event-tasks`
- Progress overview per agent per event

### 7. Update `clickup-webhook` Edge Function
Modify the existing webhook handler to:
- After fetching task detail from ClickUp, resolve assignee emails to `agent_id` using the `profiles` table
- Include `agent_id` in the upsert payload

## Architecture

```text
ClickUp List (tasks tagged "event")
        |
        v
clickup-webhook (real-time) + clickup-sync-event-tasks (bulk)
        |
        v
clickup_tasks table (with new agent_id column)
        |
        v
Agent Events Page --> EventProgressDashboard
Admin Events Page --> Task assignment + sync controls
Dashboard Home   --> EventsWidget (mini progress)
```

## Files to Create
- `src/components/events/EventProgressDashboard.tsx` -- Main progress tracker component
- `src/components/events/EventTaskList.tsx` -- Filterable/sortable task list
- `src/components/events/EventProgressStats.tsx` -- Stats cards (total, done, overdue, due soon)
- `src/components/events/EventsWidget.tsx` -- Dashboard home widget
- `src/components/admin/AdminEventTasks.tsx` -- Admin task management tab
- `supabase/functions/clickup-sync-event-tasks/index.ts` -- Bulk sync edge function
- Migration SQL for `clickup_tasks.agent_id` column + RLS update

## Files to Modify
- `src/pages/Events.tsx` -- Redesign with tabs (My Event, RSVPs, All Events)
- `src/pages/Index.tsx` -- Add EventsWidget to agent dashboard
- `src/pages/AdminEventsManagement.tsx` -- Add ClickUp Tasks tab
- `src/hooks/useEvents.ts` -- Add `fetchClickUpTasks` function to query `clickup_tasks`
- `supabase/functions/clickup-webhook/index.ts` -- Resolve agent_id from assignees
- `supabase/config.toml` -- Add new edge function entry

## Technical Details

### Agent ID Resolution (in edge functions)
When a ClickUp task has assignees, resolve to Hub agent by:
1. Get assignee email from ClickUp task detail
2. Query `profiles` table: `WHERE email = assignee_email`
3. If matched, set `agent_id` on the `clickup_tasks` row
4. If not matched, leave `agent_id` null (task still visible via event ownership)

### Progress Calculation
```text
total_tasks = COUNT(*) WHERE event_id = X
completed_tasks = COUNT(*) WHERE event_id = X AND completed_at IS NOT NULL
overdue_tasks = COUNT(*) WHERE event_id = X AND completed_at IS NULL AND due_date < TODAY
due_soon = COUNT(*) WHERE event_id = X AND completed_at IS NULL AND due_date BETWEEN TODAY AND TODAY+7
progress_pct = (completed_tasks / total_tasks) * 100
```

### New Hook: `useClickUpTasks(eventId)`
Queries `clickup_tasks` for a given event, returns:
- `tasks[]` with all fields
- `stats` (total, completed, overdue, dueSoon, progressPct)
- `tasksByResponsible` grouped data for breakdown charts
- `loading`, `error` states

### EventsWidget Data Flow
Reuses `useEvents` to get the next event, then calls `useClickUpTasks(nextEvent.id)` for the progress stats. Renders a compact card similar to `SupportWidget`.

