

# Fix OTC Sync: Filter by Team Name + Use Agent Name Field

## Root Cause

Discovery data confirms:
- OTC has a `team_name` field in `field_values` — REOP properties have `"Real Estate on Purpose"`
- OTC has an `agent_name` field in `field_values` — contains the actual agent name (e.g., "Matt Leighton")
- Current code filters by "RA:" in `important_notes` — this is fragile and catches properties from OTHER teams that happen to have RA: in notes
- Current DB: only 4 of 19 records have `team_name = "Real Estate on Purpose"`, 14 have `null`, 1 has `"No Team"` — most are wrongly assigned
- All 19 records stuck as `under_contract`, GCI values still broken (percentages stored as dollars), client names are garbage

## Changes

### 1. Edge Function (`supabase/functions/opentoclose-sync/index.ts`)

**Replace team filter logic:**
- Remove `isREOPProperty()` function (RA: notes parsing)
- New filter: `getFieldValue(property, 'team_name')` must contain "Real Estate on Purpose" (case-insensitive)
- This is the definitive filter — no more false positives

**Replace agent identification:**
- Use `getFieldValue(property, 'agent_name')` as the primary agent identifier (not RA: from notes)
- Fall back to `extractAgentFromNotes()` only if `agent_name` field is empty
- Match against Hub profiles using existing `matchAgentByName()`

**Handle unmatched agents:**
- Currently: skips properties where agent doesn't match a Hub profile
- New: sync ALL "Real Estate on Purpose" properties regardless of agent match
- Set `responsible_agent = null` when no Hub match found
- Store OTC agent name in `raw_api_data.otc_agent_name`

**Fix GCI (still broken in DB):**
- Ensure `parseCommission` and explicit GCI percentage detection run on every sync
- The existing code is correct but the DB has stale data from before the fix

**Fix stage mapping (still broken in DB):**
- Same — the `mapStage` logic with closing_date is correct but DB has stale data

**Fix client_name:**
- Stop extracting garbage from notes ("- built 2023" etc.)
- Tighten `extractClientFromNotes` to skip lines starting with "-"

**Enhance discover mode:**
- Include `team_name` and `agent_name` fields in REOP sample output
- Show all unique `team_name` values across sampled properties

### 2. Dashboard (`src/components/admin/AdminTransactionsDashboard.tsx`)

**Show unmatched agents in red:**
- In the Agent column: if `responsible_agent` is null, display `raw_api_data.otc_agent_name` in red text
- In the leaderboard: group unmatched agents under their OTC name with red styling
- In drill-down: same red treatment

### 3. Hook (`src/hooks/useAdminTransactions.ts`)

**Handle null `responsible_agent`:**
- Leaderboard grouping: use `raw_api_data.otc_agent_name` as the agent key when `responsible_agent` is null
- Add `isExternal` flag to `AgentLeaderboardEntry`

### 4. Data Cleanup

**SQL migration:**
- Delete all existing `transaction_coordination` records (they're all wrong — wrong assignments, wrong GCI, wrong stages)
- Fresh sync will repopulate with correct data filtered by team name

## Files to Modify
- `supabase/functions/opentoclose-sync/index.ts` — team_name filter, agent_name field, unmatched agent handling
- `src/components/admin/AdminTransactionsDashboard.tsx` — red styling for external agents
- `src/hooks/useAdminTransactions.ts` — handle null responsible_agent in leaderboard
- New SQL migration to clean up bad data

