

## Plan: SphereSync Contact Names + Event Task Fixes + Newsletter Recurring Tasks

Three changes across the "Tasks This Week" block and the Newsletter system.

---

### 1. Add Contact Names to SphereSync Tasks (Block Two)

**Problem**: The SphereSync section shows "Make a Call" / "Send a Text" with no indication of *who*. The `lead_id` is stored on each task but never resolved to a name.

**Fix**: After building the `sphereTasks` array, collect all `lead_id` values, batch-fetch contact names from the `contacts` table (same pattern already used in Block Five for overdue tasks), then update each task's title to include the contact name: "Call Sarah Johnson" / "Text Mike Rivera". If no contact found, fall back to the current generic title.

Also add `contactPhone` from the `contacts.phone` column so the UI can optionally display it.

**File**: `src/hooks/useDashboardBlocks.ts` — add contact lookup after line 220, update sphere task titles.

**UI File**: `src/components/dashboard/WeeklyTasksBySystem.tsx` — show contact name as the task title and phone as subtitle (replacing the current `notes` subtitle).

---

### 2. Fix Event Tasks in Block Two

**Problem**: The event task list at line 223 filters by `!t.completed_at` but does NOT apply the born-overdue guard (`created_at <= due_date`). Template tasks with retroactive due dates that happen to fall in the current week appear as pending tasks even though they were just auto-generated.

**Fix**: Apply the same `created_at <= due_date` filter to the Block Two event tasks list, consistent with what Block Four already does:

```typescript
const incompleteEventTasks = (eventTasksWeekAll.data || []).filter(t => {
  const created = new Date(t.created_at);
  const due = new Date(t.due_date);
  return !t.completed_at && created <= due;
});
```

**File**: `src/hooks/useDashboardBlocks.ts` — update line 223.

---

### 3. Newsletter Recurring Task System

**Problem**: Newsletter currently shows "0" tasks because it only checks `newsletter_campaigns` created this week. There's no recurring task mechanism to remind agents to write/schedule their newsletter.

**Approach**: Create a new `newsletter_task_settings` table to store each agent's preferred frequency and day-of-month, then compute newsletter tasks client-side in the dashboard hook (no cron needed).

**New table** (`newsletter_task_settings`):
| Column | Type | Default |
|--------|------|---------|
| id | uuid | gen_random_uuid() |
| agent_id | uuid (FK auth.users) | |
| frequency | text | 'monthly' |
| day_of_month | integer | 15 |
| enabled | boolean | true |
| created_at | timestamptz | now() |
| updated_at | timestamptz | now() |

`frequency` accepts: `'weekly'`, `'biweekly'`, `'monthly'`.

**Dashboard logic** (`useDashboardBlocks.ts`):
- Fetch the agent's `newsletter_task_settings` row (or use defaults: monthly on the 15th).
- Based on frequency, determine if a newsletter task is "due" this week:
  - **Monthly**: Check if the `day_of_month` falls within the current week's date range.
  - **Biweekly**: Check if it's an odd or even ISO week (alternating).
  - **Weekly**: Always due.
- Check if a `newsletter_campaigns` was created/sent this period. If not, generate a virtual task: "Write & schedule your newsletter" with the due date set to the target day.
- This replaces the current `newsletterTasks` logic that only looks at existing campaigns.

**Newsletter page settings** (`src/pages/Newsletter.tsx`):
- Add a small "Schedule Settings" card or section (gear icon) in the E-Newsletter page header area.
- Simple form: frequency dropdown (Weekly / Biweekly / Monthly) + day-of-month picker (only shown for monthly).
- Saves to `newsletter_task_settings` via upsert.

**New files**:
- `src/hooks/useNewsletterTaskSettings.ts` — CRUD hook for the settings table
- `src/components/newsletter/NewsletterScheduleSettings.tsx` — settings UI component

**Modified files**:
- `src/hooks/useDashboardBlocks.ts` — replace newsletter task logic with virtual task generation
- `src/pages/Newsletter.tsx` — add settings component
- Migration for the new table + RLS policies

---

### Summary of Files

| File | Change |
|------|--------|
| `src/hooks/useDashboardBlocks.ts` | Contact name lookup for sphere tasks, born-overdue guard on event tasks in Block Two, virtual newsletter task logic |
| `src/components/dashboard/WeeklyTasksBySystem.tsx` | Display contact names and phone for SphereSync tasks |
| `src/hooks/useNewsletterTaskSettings.ts` | New — CRUD hook for newsletter frequency settings |
| `src/components/newsletter/NewsletterScheduleSettings.tsx` | New — frequency/day settings UI |
| `src/pages/Newsletter.tsx` | Add schedule settings section |
| New migration | `newsletter_task_settings` table + RLS |

