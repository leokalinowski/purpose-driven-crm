
Goal: fix three connected issues on `/events`: (1) status controls are hard to find, (2) task UI feels stale after edits, and (3) mobile layout still forces horizontal space.

What I found
1. The current logged-in user role is `managed` (from `get_current_user_role` network response), so the page should be rendering `SelfManagedTaskDashboard`.
2. Status changes in `SelfManagedTaskDashboard` are currently icon-only (circle/clock/check). Technically clickable, but visually easy to miss (looks like static status indicator).
3. `TaskForm` and `TaskEditForm` each call `useEvents()` internally, creating separate hook state instances from the dashboard. This can make updates feel delayed/inconsistent across the visible page (depends on realtime events to sync).
4. Remaining responsive gaps:
   - `Events.tsx` loading skeleton area still uses fixed desktop layout (`flex` + `grid-cols-4`).
   - Task rows in `SelfManagedTaskDashboard` are still single-row `flex` with tight action area.
   - `EventTaskList` has fixed-width controls (`w-[130px]`) and single-line row layout that can overflow on small viewports.

Implementation plan
1. Make status control explicit and always visible (no edit modal needed)
   - File: `src/components/events/SelfManagedTaskDashboard.tsx`
   - Replace icon-only status click with an inline 3-option control per task row:
     - To Do (`pending`)
     - In Progress (`in_progress`)
     - Done (`completed`)
   - Keep one-tap interaction directly in row, with clear active styling and labels.
   - Preserve `completed_at` logic when entering/leaving `completed`.

2. Make task updates reliably reflect immediately on the current page
   - Files:
     - `src/components/events/TaskEditForm.tsx`
     - `src/components/events/TaskForm.tsx`
     - `src/components/events/SelfManagedTaskDashboard.tsx`
   - Refactor forms to receive mutation callbacks from parent instead of calling `useEvents()` themselves.
   - Parent dashboard remains single source of truth for task list state.
   - After successful mutation, update local list immediately and run `fetchEventTasks()` as a safety sync.

3. Complete mobile responsiveness for Events/task UI
   - File: `src/pages/Events.tsx`
     - Make loading skeleton header/grid responsive.
     - Ensure tabs are horizontally scrollable with non-shrinking triggers.
   - File: `src/components/events/SelfManagedTaskDashboard.tsx`
     - Convert task rows to `flex-col` on mobile, `sm:flex-row` on larger screens.
     - Ensure status controls/actions wrap and remain visible without widening viewport.
     - Stack “Tasks” header title + Add button on small screens.
   - File: `src/components/events/EventTaskList.tsx`
     - Make filter/sort controls wrap and go full-width on mobile.
     - Allow task right-side metadata (date/badge) to wrap below title on narrow screens.

4. Prevent future “no toggle” confusion in non-editable mode
   - File: `src/components/events/EventProgressDashboard.tsx`
   - If the dashboard is in ClickUp read-only mode, add a clear “Read-only” label/message near tasks.
   - (Optional safeguard) fallback to self-managed view when ClickUp mode has zero tasks configured.

Technical details
- Keep existing DB status values unchanged (`pending`, `in_progress`, `completed`, `overdue`).
- Use parent-owned mutation flow to avoid divergent hook states from multiple `useEvents()` instances.
- Prefer responsive class pattern:
  - `flex-col sm:flex-row`
  - `w-full sm:w-auto`
  - `flex-wrap`
  - `grid-cols-2 md:grid-cols-4`
  - `shrink-0` on controls that must stay tappable.

Files to update
- `src/components/events/SelfManagedTaskDashboard.tsx`
- `src/components/events/TaskEditForm.tsx`
- `src/components/events/TaskForm.tsx`
- `src/components/events/EventTaskList.tsx`
- `src/components/events/EventProgressDashboard.tsx`
- `src/pages/Events.tsx`

Validation checklist after implementation
1. On mobile width, each task row shows visible status controls without opening Edit.
2. Changing status updates immediately in the same view (no manual refresh).
3. Add/Edit task reflects instantly in list and stats.
4. Tabs, filter controls, and row action buttons remain accessible without horizontal clipping.
