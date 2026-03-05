## SphereSync and DNC API Review: Bugs, Inconsistencies, and Improvements

### Critical Bugs

**1. `dnc-monthly-check` and `dnc-single-check` use `verify_jwt = true` in config.toml (lines 52, 55)**
The project uses Supabase signing-keys, which are incompatible with `verify_jwt = true`. This causes authentication failures at the gateway level before the function code even runs. Both functions already implement their own JWT verification in code (via `getUser()` / auth header forwarding). This means:

- Agents clicking "Run DNC Check" get auth errors
- Individual DNC checks on contact creation/edit fail silently
- Cron-triggered monthly checks also fail

Fix: Set `verify_jwt = false` for both functions in `supabase/config.toml`.

**2. `dnc-monthly-check` requires admin role but agents call it from the frontend**
The edge function (line 113) rejects any user whose role is not `admin`. But `useDNCStats.triggerDNCCheck()` is called by regular agents from the Database page. Non-admin agents clicking "Run DNC Check" receive a 403 Forbidden error. The function should allow agents to check their own contacts (scoped by `agentId` parameter), while reserving the global batch mode for admins.

**3. SphereSync task generation includes DNC-flagged contacts**  
Neither the frontend `generateWeeklyTasksInternal` (useSphereSyncTasks.ts) nor the edge function `spheresync-generate-tasks` filters out contacts where `dnc = true`. This means agents receive call/text tasks for contacts on the Do Not Call list -- a compliance risk. They should keep receiving the DNC contacts to reach out to, but we need to make sure they are more visible and clear that it's their own decision to contact them or not (Real Estate on Purpose is not responsible).

**5. `dnc-monthly-check` updates `dnc_last_checked` on API failure (lines 352-360)**
When the DNC API call fails (timeout, 500 error, etc.), the catch block still updates `dnc_last_checked` to `now()`. This means the contact won't be rechecked for another 30 days despite never actually being verified. The timestamp should only be set on successful API responses. Contacts not checked when there is a failed attempt, should be rerun and rechecked as a backup plan.

### Medium Bugs

**6. `dnc-monthly-check` queries `profiles.role` instead of `user_roles` table (lines 191, 200)**
The function filters agents via `.in('role', ['agent', 'admin'])` on the `profiles` table. But the project's authoritative role source is the `user_roles` table. The `profiles.role` column may be stale or out of sync, causing agents to be missed or incorrectly included in batch DNC runs. Should query `user_roles` instead, consistent with `spheresync-generate-tasks` (which correctly uses `user_roles`).

**7. `spheresync-email-function` uses incomplete CORS headers (line 5-8)**
The function defines its own `corsHeaders` object missing the `x-supabase-client-platform*` and `x-supabase-client-runtime*` headers that the shared `_shared/cors.ts` includes. This can cause CORS preflight failures when called from the frontend. Should import from `_shared/cors.ts` like the other functions.

**8. `spheresync-generate-tasks` uses `getUser()` instead of `getClaims()` (line 156)**
Per the project's security standard, edge functions should use `getClaims(token)` for JWT verification rather than `getUser()` (which makes a server round-trip). This is slower and inconsistent with the pattern used in other functions.

### Inconsistencies

**9. Triple-duplicated letter mapping tables**
`SPHERESYNC_CALLS` and `SPHERESYNC_TEXTS` are copy-pasted across 3 files:

- `src/utils/sphereSyncLogic.ts` (frontend)
- `supabase/functions/spheresync-generate-tasks/index.ts`
- `supabase/functions/spheresync-email-function/index.ts`

If any letter mapping is updated in one file, the other two become stale. The edge functions can't share code with the frontend, but the two edge functions could import from a shared module (e.g., `_shared/spheresync-config.ts`).

**10. `dnc-single-check` uses `serve()` from std (old pattern) while `dnc-monthly-check` uses `Deno.serve()` (new pattern)**
The `dnc-single-check` function uses the deprecated `serve` import from `std@0.168.0`, while `dnc-monthly-check` uses native `Deno.serve()`. The project standard prefers `Deno.serve()`.

### Proposed Fixes (Priority Order)


| #      | Issue                                                          | File(s)                                         | Severity                             |
| ------ | -------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------ |
| 1      | Set `verify_jwt = false` for DNC functions                     | `supabase/config.toml`                          | Critical - functions broken          |
| 2      | Allow agents to run DNC checks on their own contacts           | `supabase/functions/dnc-monthly-check/index.ts` | Critical - feature broken for agents |
| &nbsp; | &nbsp;                                                         | &nbsp;                                          | &nbsp;                               |
| &nbsp; | &nbsp;                                                         | &nbsp;                                          | &nbsp;                               |
| 5      | Don't update `dnc_last_checked` on API failure                 | `dnc-monthly-check/index.ts`                    | Medium - data integrity              |
| 6      | Use `user_roles` table instead of `profiles.role` in DNC check | `dnc-monthly-check/index.ts`                    | Medium - correctness                 |
| 7      | Import shared CORS headers in email function                   | `spheresync-email-function/index.ts`            | Medium - reliability                 |
| 8      | Use `getClaims()` instead of `getUser()` in generate-tasks     | `spheresync-generate-tasks/index.ts`            | Low - consistency                    |
