

# Fix OTC Sync: Filter to REOP Agents Only + Correct Agent Matching

## Problem Analysis

From the edge function logs, the current sync is broken in three ways:

1. **No team filtering**: Fetching all 2,493 properties from the OTC account — most belong to other teams, not "Real Estate on Purpose"
2. **Wrong agent matching**: The `matchAgent` function matches by first name, causing false positives (e.g., "Ashley" in an OTC field matches Ashley Spencer even though she's not the agent for that property). Currently 18 properties synced — all incorrectly assigned.
3. **Missing GCI data**: All synced properties show `gci: 0` because the field keys may not match exactly

The `important_notes` field contains "RA: Agent Name" which identifies the REOP agent, but names don't match Hub profiles precisely enough. The `team_user_name` top-level field is the transaction coordinator (Alicia Brown, Christine Jones, Wendy Heisen), NOT the agent.

## Plan

### Step 1: Set `verify_jwt = false` for opentoclose-sync
So we can invoke discover mode from the dashboard and test calls.

### Step 2: Enhance discover mode to log filtering clues
Return samples of `important_notes`, `team_user_name`, `team_name`, `contract_title`, and any team-related fields from 10+ properties — so we can see how REOP properties are distinguished from others.

### Step 3: Fix the edge function sync logic

**A. Add team filtering**: Filter properties where the "RA:" pattern exists in `important_notes` — this is the REOP identifier. Properties without "RA:" in notes are from other teams and should be skipped entirely.

**B. Fix agent matching**: 
- Remove first-name-only matching (too many false positives)
- Match "RA: Name" against Hub profiles using full name (fuzzy: normalize spaces, case-insensitive)
- Also try `last_name` matching as fallback (more unique than first name)
- Log detailed match attempts for debugging

**C. Fix GCI mapping**: Check additional field keys like `commission_amount`, `gci_amount`, `agent_commission`, `total_commission_amount` in discover output and map correctly.

**D. Fix client_name**: Currently using `contract_title` which returns the address. Try `buyer_name`, `seller_name`, or contacts endpoint for the actual client name.

### Step 4: Clean up bad data
Delete all incorrectly synced transactions from `transaction_coordination` (the 18 wrong ones) before re-syncing.

### Step 5: Add discover button to Admin UI
Add a "Discover OTC Fields" button in the sync controls section that calls `mode: 'discover'` and displays the raw field structure — so you can see exactly what OTC returns and verify the mapping is correct.

### Step 6: Re-sync and verify
Trigger a fresh sync after the fix. Verify Traci Johnson and Timothy Raiford appear with correct data.

## Files to Modify
- `supabase/config.toml` — set `verify_jwt = false` for opentoclose-sync
- `supabase/functions/opentoclose-sync/index.ts` — enhanced discover mode, team filtering, fixed agent matching
- `src/components/admin/AdminTransactionsDashboard.tsx` — add discover button
- `src/hooks/useAdminTransactions.ts` — add discover function
- SQL migration to delete bad data

