

## Improve Reliability Without Breaking Anything

After auditing the codebase, here are targeted, low-risk improvements across the frontend that harden error handling, prevent silent failures, and improve the user experience during network issues.

### 1. Configure QueryClient with sensible defaults

**File**: `src/App.tsx`

Currently `new QueryClient()` uses React Query defaults (3 retries, no stale time, refetch on window focus). This means every tab focus triggers refetches across all queries, and failed requests retry 3 times with no backoff. Configure:

- `staleTime: 60_000` (1 min) -- reduce unnecessary refetches
- `retry: 2` with exponential backoff
- `refetchOnWindowFocus: 'always'` only for critical queries
- Global `onError` that logs failures

### 2. Add retry + error resilience to useSubscription

**File**: `src/hooks/useSubscription.ts`

- Add retry logic (up to 2 attempts with backoff) for `check-subscription` calls
- On persistent failure, preserve the last known subscription state instead of leaving it stale
- Catch popup-blocker for `window.open` in `createCheckout` and fall back to `window.location.href`

### 3. Guard admin dashboard against 1000-row limit

**File**: `src/hooks/useDashboardData.ts`

The admin `fetchAdminData` fetches `contacts`, `tasks`, `transactions`, `events`, and `newsletters` with no pagination -- all hitting Supabase's 1000-row default limit. For a growing team, this will silently truncate data and produce wrong metrics.

- Switch admin queries to use `{ count: 'exact', head: true }` where only counts are needed
- For queries that need row data (agent performance), use range-based pagination to fetch all rows
- Add `.limit(10000)` as a safety net on data queries

### 4. Add network-aware toast for Supabase errors

**File**: `src/lib/utils.ts` (new helper)

Create a `handleSupabaseError(error, context)` utility that:
- Detects network offline (`navigator.onLine === false`) and shows "You're offline" toast
- Detects auth expiry (401/PGRST301) and shows "Session expired, please sign in again"
- Wraps generic errors with context ("Failed to load contacts")

### 5. Harden realtime subscriptions with reconnection

**File**: `src/hooks/useDashboardData.ts`

The realtime subscription logs status but doesn't handle disconnections. Add:
- On `CHANNEL_ERROR` or `TIMED_OUT`, attempt resubscription after a delay
- Clear stale debounce timers on unmount (already done, but add a mounted ref guard)

### 6. Prevent stale auth state on token refresh failure

**File**: `src/hooks/useAuth.tsx`

Add a listener for `TOKEN_REFRESHED` vs `SIGNED_OUT` events. If a token refresh fails silently (network issue), the user can be left with an expired session showing authenticated UI. Add a periodic session validity check.

---

### Technical Details

**Files changed**: 
- `src/App.tsx` -- QueryClient config
- `src/hooks/useSubscription.ts` -- retry logic, popup fallback
- `src/hooks/useDashboardData.ts` -- row limit fix, realtime reconnection
- `src/lib/utils.ts` -- new error handler utility
- `src/hooks/useAuth.tsx` -- token refresh resilience

**Risk level**: Low. All changes are additive (new defaults, new error handlers, new guards). No data model changes, no API changes, no UI layout changes. Existing behavior is preserved; we're adding safety nets around it.

