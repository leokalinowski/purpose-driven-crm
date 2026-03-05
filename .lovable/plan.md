

## Plan: Accountability Score + Time-Based Triage (B + C Blend)

### Overview

Redesign Block Five from a flat list of 400+ tasks into a smart "Action Center" with three layers: an Accountability Score (0-100), a priority section for recent overdue items, and a collapsed cleanup summary for ancient tasks.

### Data Changes — `src/hooks/useDashboardBlocks.ts`

Update the `BlockFiveOverdue` type to include computed fields:

```typescript
export type BlockFiveOverdue = {
  accountabilityScore: number;       // 0-100
  priorityTasks: OverdueTask[];      // overdue ≤14 days
  cleanupSummary: {                  // overdue >14 days, grouped
    spheresync: number;
    events: number;
    coaching: number;
    total: number;
  };
  nextMilestone: { score: number; tasksNeeded: number }; // e.g. "Complete 3 tasks to reach 80"
  allTasks: OverdueTask[];           // full list for "view all"
};
```

**Accountability Score formula**: Based on the ratio of on-time completions vs total expected tasks across the last 4 weeks. Score = `Math.round((completedOnTime / totalExpected) * 100)`. Uses existing Block Four data (spheresync + events + coaching completions) so no new queries needed.

**Split tasks**: After building `overdueItems`, partition into `priorityTasks` (daysOverdue ≤ 14) and `cleanupSummary` (count by system for daysOverdue > 14).

**Next milestone**: Calculate how many priority tasks need completing to bump the score by 5-10 points.

### UI Redesign — `src/components/dashboard/OverdueTasks.tsx`

Replace the current flat list with a 3-section layout:

**Section 1 — Accountability Score (always visible)**
- Large circular or semicircular score gauge (0-100) with color coding (green ≥80, amber 50-79, red <50)
- Motivational nudge text: "Complete 3 more tasks to reach 85!" or "You're crushing it at 92!"
- Score label: "Your Accountability Score"

**Section 2 — This Week's Priority (expanded by default)**
- Only tasks overdue by ≤14 days (the ones that actually matter right now)
- Each item shows: system badge, task title, days overdue, action button
- If empty: "No recent overdue tasks — nice work!" message
- Capped at 5 visible items with "show more" if needed

**Section 3 — Needs Cleanup (collapsed by default)**
- A single collapsible row showing: "23 older tasks need attention" with per-system counts (SphereSync: 444, Events: 2, Scoreboard: 1)
- Each system gets a "Go to page" button to navigate and bulk-handle
- Uses the Collapsible component from the existing UI library

**Visual treatment**: The card border color adapts to the score (green/amber/red instead of always destructive red). When score is high and no priority tasks exist, the section feels celebratory rather than alarming.

### Files Changed

1. **`src/hooks/useDashboardBlocks.ts`** — Update `BlockFiveOverdue` type, add score calculation, split overdue into priority vs cleanup
2. **`src/components/dashboard/OverdueTasks.tsx`** — Full UI rewrite with score gauge + priority list + collapsed cleanup

### Also: Transaction Source Change

In the same hook file, replace the `transaction_coordination` query with a sum of `closings` from `coaching_submissions` for the current year, as requested.

