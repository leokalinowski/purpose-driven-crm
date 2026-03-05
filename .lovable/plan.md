## Dashboard Rework Plan

### Overview

Replace the current "Agent Dashboard" with a new "Dashboard" that has 5 focused blocks pulling real data from SphereSync, Events, Newsletter, Social, and Coaching systems.

### Rename

- `AppSidebar.tsx` line 87: `'Agent Dashboard'` → `'Dashboard'`
- `Index.tsx` page title: `'Agent Dashboard'` → `'Dashboard'`

---

### Block One: Weekly Touchpoints + Contacts Touched

A prominent hero card showing:

- **Total Touchpoints This Week**: Sum of completed SphereSync tasks (calls + texts) + newsletter sends (from `newsletter_campaigns`) + event invitations (from `event_emails`) + social posts published (from `social_posts`)
- **Unique Contacts Touched**: Deduplicated count of contacts reached across all channels
- Visual breakdown bar showing contribution per channel (calls, texts, emails, social, events)

**Data sources**: `spheresync_tasks` (completed this week), `event_emails` (sent this week), `social_posts` (published this week), `newsletter_campaigns` (sent this week)

---

### Block Two: Tasks for the Week (Grouped by System)

Separate cards/sections for each system, each showing pending tasks:


| System       | Data Source                                            | What to show                                             |
| ------------ | ------------------------------------------------------ | -------------------------------------------------------- |
| SphereSync   | `spheresync_tasks` (current week, not completed)       | Call/text tasks with contact name, phone, action buttons |
| Events       | `event_tasks` (due this week, not completed)           | Task name, event name, due date, status                  |
| Newsletter   | `newsletter_campaigns` (drafts or scheduled this week) | Campaign name, status, scheduled date                    |
| Social Media | `social_posts` (scheduled this week, not posted)       | Post preview, platform, scheduled time                   |
| Scoreboard   | `coaching_submissions` (current week missing?)         | Whether this week's submission is done, link to submit   |


Each section shows a count badge and collapses if empty. Only show systems the user has access to (via `useFeatureAccess`).

---

### Block Three: Transaction Opportunity Calculator

Based on the industry benchmark: 1 transaction per 6 contacts per year.

Display:

- **Database size** (from `contacts` count)
- **Annual target**: contacts ÷ 6
- **Monthly target**: annual ÷ 12
- **Potential Yearly Dollar amount**: Annual Target × average GCI (calculated from a fallback of $8,000 average)
- Visual progress bar: Monthly target growing along the year

---

### Block Four: Task Execution Performance

- **Current week completion %**: tasks completed ÷ total tasks across all systems this week
- **Trend chart** (last 6-8 weeks): line chart showing weekly completion rate over time
- Breakdown by system (small badges showing per-system completion)

**Data sources**: `spheresync_tasks` historical stats, `event_tasks` completion, `coaching_submissions` streak

---

### Block Five: Overdue Tasks (Actionable)

Red-highlighted section listing all overdue tasks across systems:

- SphereSync tasks from previous weeks still not completed
- Event tasks past due date and not completed
- Coaching submissions for past weeks not submitted

Each overdue item shows: task description, how many days overdue, and action buttons (call/text for SphereSync, navigate for events/coaching). Items sorted by most overdue first.

---

### Technical Approach

**New hook**: `src/hooks/useDashboardBlocks.ts` — single hook that fetches all 5 blocks' data in parallel from Supabase. Replaces the current scattered data fetching.

**New components** (all in `src/components/dashboard/`):

- `WeeklyTouchpoints.tsx` — Block One
- `WeeklyTasksBySystem.tsx` — Block Two
- `TransactionOpportunity.tsx` — Block Three
- `TaskPerformance.tsx` — Block Four
- `OverdueTasks.tsx` — Block Five

**Modified files**:

- `src/pages/Index.tsx` — Replace current layout with 5 new blocks
- `src/components/layout/AppSidebar.tsx` — Rename to "Dashboard"

**Removed from Index.tsx** (components no longer needed on dashboard):

- `AgentMetricsCards` (replaced by Blocks One + Three)
- `AgentActivityWidget` (replaced by Block Two)
- `AgentPerformanceCharts` (replaced by Block Four)
- `SupportWidget` and `EventsWidget` (integrated into Blocks Two + Five)

The existing components won't be deleted — they're still used on other pages — they'll just no longer be rendered on the main dashboard.