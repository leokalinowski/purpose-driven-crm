
## Accountability Center: Better Messaging + Contact Names + Remove Old Tasks

### Changes

**1. Pull contact names for SphereSync tasks**

The `spheresync_tasks` query already fetches `lead_id`. Add a follow-up query to fetch contact names for the overdue task lead IDs:

```typescript
const leadIds = overdueSphereTasks.map(t => t.lead_id).filter(Boolean);
const { data: contacts } = await supabase.from('contacts')
  .select('id, first_name, last_name').in('id', leadIds);
```

Then update the task title from `"Call task from W8"` to `"Call Sarah Johnson (W8)"` — much more actionable.

Add `contactName` to the `OverdueTask` type.

**2. Only show tasks from last 2 weeks (remove older tasks entirely)**

Change the SphereSync overdue filter: only include tasks where `weeksDiff <= 2` (current week minus 1 and minus 2). Drop the cleanup section entirely — no more "398 older tasks need attention." Those are gone.

For coaching, limit to 2 past weeks instead of 4.

Remove `cleanupSummary` and `allTasks` from the `BlockFiveOverdue` type since they're no longer needed.

**3. Rewrite nudge messaging to be clearer and more actionable**

Replace the generic nudge text with specific, action-oriented messages:

- Score ≥ 95: "All caught up — your consistency is paying off!"
- Score ≥ 80, no overdue: "Great momentum this week. Keep showing up for your sphere."
- Score ≥ 80, some overdue: "You're close — knock out these {n} tasks to stay on track."
- Score ≥ 50: "You have {n} people waiting to hear from you. A quick call today can make the difference."
- Score < 50: "Your sphere needs you — start with just one call to build momentum."

Add a subtitle under the score explaining what it means: "Based on your last 4 weeks of task completion across SphereSync, Events, and Scoreboard."

**4. Group overdue tasks by week instead of flat list**

Instead of listing each task individually, group by week: "Week 8 — 23 tasks" and "Week 9 — 23 tasks" with expand/collapse per week. When expanded, show contact names.

### Files Changed

1. **`src/hooks/useDashboardBlocks.ts`** — Add contact name lookup, limit overdue to 2 weeks, remove cleanup, update type
2. **`src/components/dashboard/OverdueTasks.tsx`** — Rewrite messaging, group by week, show contact names, remove cleanup section
