

# Admin Transaction Dashboard — Team-Wide OTC View

## Overview
Add a new "Transactions" tab to the existing Admin Dashboard (`/admin/dashboard`) that provides a team-wide view of all agents' transactions, GCI, volume — mirroring what you see in OpenToClose but inside the Hub. Includes a leaderboard, agent drill-down, and improved sync reliability.

## Architecture

The Admin Dashboard already has a tab pattern (`company | agent | spheresync | users`). We add a 5th tab: **Transactions**.

```text
Admin Dashboard Tabs:
┌──────────┬─────────────┬──────────────┬─────────────┬──────────────┐
│ Company  │ Agent Perf  │ Transactions │ SphereSync  │ User Mgmt    │
└──────────┴─────────────┴──────────────┴─────────────┴──────────────┘
                              ▲
                    New tab with 4 sections:
                    1. Team-wide KPI cards
                    2. Agent leaderboard
                    3. All-agent transaction table
                    4. Agent drill-down (click row)
```

## New Files

### 1. `src/hooks/useAdminTransactions.ts`
Hook that fetches ALL transactions from `transaction_coordination` (no agent filter — admin-only). Calculates:
- Team totals: YTD sales volume, YTD GCI, MTD GCI, total ongoing, closing rate, avg deal velocity
- Per-agent breakdown: group by `responsible_agent`, join with `profiles` for agent names
- Sync status: `last_synced_at` from most recent transaction, count of `sync_errors`
- Leaderboard data: sorted by GCI descending

### 2. `src/components/admin/AdminTransactionsDashboard.tsx`
Main component rendered in the new Transactions tab. Contains:

**Section A — Team KPI Cards** (grid of 6):
- Total Sales Volume YTD, Total GCI YTD, MTD GCI, Active Pipeline Value, Avg Deal Velocity, Team Closing Rate

**Section B — Agent Leaderboard**:
- Ranked table: Agent Name, Closed Deals, Total GCI, Sales Volume, Avg Deal Size, Closing Rate
- Highlight top 3 with gold/silver/bronze badges
- Click row → scrolls to drill-down section

**Section C — Full Transaction Table**:
- All transactions across all agents with agent name column added
- Filters: agent dropdown, stage (all/under_contract/closed), date range
- Sortable columns

**Section D — Sync Controls**:
- "Sync All Agents" button (calls `opentoclose-sync` for each agent, or a new bulk endpoint)
- Last sync timestamp display
- Error count badge with expandable error list

## Modified Files

### `src/pages/AdminDashboard.tsx`
- Add 5th tab "Transactions" to the `TabsList` (change grid-cols-4 → grid-cols-5)
- Import and render `AdminTransactionsDashboard` in the new `TabsContent`

### `supabase/functions/opentoclose-sync/index.ts`
- Add a `mode: 'team'` option that syncs for ALL agents (not just one `agentId`)
- Query all profiles with agent/admin roles, sync each
- Return per-agent sync results with error details
- Better error handling: catch per-deal errors, store in `sync_errors` column

## RLS Consideration
The existing `transaction_coordination` RLS likely restricts to `responsible_agent = auth.uid()`. We need an admin policy:
```sql
CREATE POLICY "Admins can view all transactions"
ON transaction_coordination FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
```

## Implementation Order
1. Add RLS policy for admin access
2. Create `useAdminTransactions` hook
3. Build `AdminTransactionsDashboard` component (KPIs, leaderboard, table, sync controls)
4. Wire into Admin Dashboard as new tab
5. Improve `opentoclose-sync` with team mode and better error reporting

