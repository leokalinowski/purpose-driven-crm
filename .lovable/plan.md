

# Fix OTC Sync: Rate Limit Crash + Paginated Architecture

## Root Cause

The logs show the exact failure:

```
OTC API error [/properties?limit=50&offset=250]: 429 {"message":"rate limit exceeded"}
Sync error: Error: OTC API 429: Too Many Requests
```

The function tries to fetch **all 2,493 properties** in memory before syncing any. With a 1.2s delay between 50-property pages, it hits OTC's rate limit after ~5 pages (250 properties). The entire function crashes, saving **zero records**. The DB is empty.

## Fix: Paginated Batch Sync

Instead of fetching everything then syncing, process **one batch per function invocation**. The frontend loops through batches.

### Edge Function Changes (`opentoclose-sync/index.ts`)

**A. Add retry with exponential backoff to `otcFetch`:**
- On 429, wait 5s then retry (up to 3 times)
- Increase base delay between pages from 1.2s to 3s

**B. New `mode: 'batch'` — process one page at a time:**
- Accept `offset` parameter (default 0)
- Fetch one page of 50 properties
- Filter for REOP (`team_name` contains "Real Estate on Purpose")
- Upsert matching properties immediately
- Return `{ offset, synced, hasMore, nextOffset }` so frontend can loop

**C. Keep `mode: 'discover'` as-is** (only fetches 200 properties, usually OK)

**D. Remove the old full-fetch `mode: 'team'`** — replace with batch orchestration

### Frontend Changes (`useAdminTransactions.ts`)

**Replace `syncAllAgents` with batch loop:**
```
async syncAllAgents():
  offset = 0
  totalSynced = 0
  loop:
    invoke('opentoclose-sync', { mode: 'batch', offset })
    totalSynced += result.synced
    if !result.hasMore: break
    offset = result.nextOffset
    wait 1s between calls
  refetch data
```

This avoids edge function timeouts and respects OTC rate limits since each invocation only makes 1 API call.

### Dashboard Changes (`AdminTransactionsDashboard.tsx`)

- Show sync progress during batch loop: "Syncing... page 3, 12 REOP found so far"
- Keep all existing UI (leaderboard, tables, KPIs, red external agents)

## Files to Modify
- `supabase/functions/opentoclose-sync/index.ts` — retry logic, batch mode, remove full-fetch
- `src/hooks/useAdminTransactions.ts` — batch loop sync
- `src/components/admin/AdminTransactionsDashboard.tsx` — sync progress display

