

## Event Data Not Pulling Correctly — Root Cause and Fix

### Problem

When you created an event (March 31, 2026), the 42-task template auto-generated tasks with due dates backdated relative to the event — some as early as January 31. This causes three cascading problems:

**Bug 1: Historical trend is corrupted.** The 8-week trend chart assigns event tasks to past weeks by `due_date`. Tasks created *today* with due dates in W5–W9 now appear as "expected but not completed" for those weeks, tanking historical completion percentages from real numbers down to near-zero. A task shouldn't pollute a past week's stats if it didn't exist during that week.

**Bug 2: Instant overdue flood.** All 6 event tasks with due dates before today immediately appear as overdue in the Accountability Center — even though you just created the event seconds ago. The user shouldn't be punished for template-generated tasks that were born past-due.

**Bug 3: Performance % is deflated.** Block Four counts 3 event tasks as "expected this week" (due 3/2, 3/4, 3/7). Two of those are already past-due and uncompleted, dragging the completion % down artificially on the same day the event was created.

### Root Cause

All three bugs share one root cause: **no `created_at` guard**. The code assumes a task's `due_date` reflects when it was "active," but template-generated tasks are created in bulk with retroactive due dates.

### Fix — `src/hooks/useDashboardBlocks.ts`

**Fix 1: Historical trend — filter by `created_at`**

In the trend loop (lines 320-326), when filtering event tasks for a historical week, add a guard: only include a task if it was created *before* the end of that historical week. If `created_at > weekEnd`, skip it.

```typescript
const weekEventTasks = (eventTasksHistory.data || []).filter(t => {
  if (!t.due_date) return false;
  const d = new Date(t.due_date);
  const created = new Date(t.created_at);
  return d >= wStart && d <= wEnd && created <= wEnd; // ← new guard
});
```

**Fix 2: Overdue tasks — exclude born-overdue tasks**

In the event tasks overdue section (lines 375-384), skip tasks where `created_at > due_date` (task was created after its own due date — it was born overdue from a template). These aren't genuine misses; they're template artifacts.

This requires adding `created_at` to the overdue event tasks query (line 158):
```
.select('id, task_name, due_date, status, completed_at, event_id, created_at')
```

Then filter:
```typescript
(eventTasksOverdue.data || []).forEach(t => {
  const created = new Date(t.created_at);
  const due = new Date(t.due_date!);
  if (created > due) return; // born overdue — skip
  // ... existing push logic
});
```

**Fix 3: Performance current week — same `created_at` guard**

For Block Four's current week event task count (line 294-296), apply the same filter: exclude tasks where `created_at` is after the due date. Add `created_at` to the week query select (line 155):
```
.select('id, task_name, due_date, status, completed_at, event_id, phase, created_at')
```

Then filter the `allEventWeek` array before counting:
```typescript
const allEventWeek = (eventTasksWeekAll.data || []).filter(t => {
  const created = new Date(t.created_at);
  const due = new Date(t.due_date);
  return created <= due; // only count tasks that existed before their due date
});
```

### Files Changed

- `src/hooks/useDashboardBlocks.ts` — Add `created_at` to two event task queries' select fields, add born-overdue guards in three places (trend, overdue, performance)

No UI component changes needed.

