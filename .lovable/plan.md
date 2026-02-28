
### Investigation outcome
- Deep-link hosting fallback is likely not the primary issue.
- The stronger culprit is client-side auth boot timing + non-preserved auth redirects:
  - `useAuth` can briefly set `loading=false` with `user=null` before session hydration completes.
  - several pages redirect to `/auth` without a `redirect` query.
  - `Auth.tsx` defaults post-auth navigation to `/`, so those bounces land on Dashboard.
- `AdminEventsManagement.tsx` is especially vulnerable: it checks only `roleLoading/isAdmin` and can redirect to `/` before auth is resolved.

### Implementation plan
1. **Stabilize auth initialization (`src/hooks/useAuth.tsx`)**
   - keep auth listener updates for `user/session`.
   - make `loading` transition to `false` only after `getSession()` resolves (not immediately from initial auth callback).
   - eliminate transient unauthenticated redirects during refresh.

2. **Align role loading with auth loading (`src/hooks/useUserRole.ts`)**
   - consume `useAuth().loading`.
   - while auth is still loading, keep role hook in loading state.
   - only resolve role as `null` after auth has definitively resolved without a user.

3. **Preserve intended route when redirecting to auth**
   - add a small shared helper (e.g. `buildAuthRedirectPath`) that builds:
     - `/auth?redirect=${encodeURIComponent(pathname + search + hash)}`
   - update all page-level `navigate('/auth')` redirects to use this preserved path:
     - `src/pages/Index.tsx`
     - `src/pages/Events.tsx`
     - `src/pages/Support.tsx`
     - `src/pages/AdminDashboard.tsx`
     - `src/pages/AdminEmailLogs.tsx`
     - `src/pages/AdminSphereSyncRecovery.tsx`
     - `src/pages/AdminTeamManagement.tsx` (and include `authLoading` guard first)

4. **Fix admin-events refresh edge case (`src/pages/AdminEventsManagement.tsx`)**
   - add explicit auth guard (`authLoading` + `user`) before role redirect logic.
   - redirect unauthenticated users to auth with preserved redirect path.
   - only run `!isAdmin -> navigate('/')` once both auth and role are resolved.

5. **Verification on deployed domain**
   - hard-refresh while logged in on:
     - `/events`
     - `/social-scheduler`
     - `/database`
     - `/admin/events` (admin account)
   - confirm URL and page remain the same after refresh.
   - confirm forced unauth access sends to `/auth?redirect=...`, and successful auth returns to original page (not `/`).

### Technical details
- Core behavior target:
  - “Refresh should never send an authenticated user to `/` unless they were already on `/`.”
- Redirect flow target:
  - page guard → `/auth?redirect=/current/path?...`
  - auth success → `navigate(redirectParam, { replace: true })`
- This keeps existing routing architecture (`BrowserRouter`) and avoids invasive route refactors.
