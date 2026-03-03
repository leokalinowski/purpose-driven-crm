

## Admin Edge Functions Review: Findings and Fix Plan

### Issues Found

#### 1. CRITICAL -- `admin-contacts-cleanup`: Fake auth (privilege escalation risk)
- **No JWT verification at all.** It uses `SUPABASE_SERVICE_ROLE_KEY` directly (line 16-18) and trusts a `adminUserId` field from the request body to verify admin status.
- Any caller can send `{ adminUserId: "<known-admin-uuid>", agentId: "..." }` and the function will happily verify that UUID is an admin and proceed. The caller's identity is never checked.
- Also checks admin role via `profiles.role` (line 34-40) instead of the `user_roles` table, which is the canonical source for roles.
- **Missing from config.toml** -- defaults to `verify_jwt = true`, which doesn't work with signing-keys.

#### 2. CRITICAL -- `admin-delete-user` and `admin-update-user-metadata`: Outdated auth pattern
- Both use `getUser()` instead of `getClaims()` for auth verification. This works but is the older, slower pattern (network round-trip to Supabase auth server).
- Both check admin role via `user_roles` table directly (correct table, but direct query instead of the `get_current_user_role()` RPC, which is the established pattern elsewhere).
- Both use an outdated Supabase SDK version: `@supabase/supabase-js@2.7.1` vs `@2.53.0` used elsewhere.
- **Neither is in config.toml** -- defaults to `verify_jwt = true`, broken with signing-keys.
- Error responses return `400` for auth failures instead of `401`/`403`.

#### 3. MODERATE -- `admin-contacts-import`: Cleanest of the four, but has quirks
- Properly uses `getClaims()` and `get_current_user_role()` RPC -- good.
- Has `verify_jwt = true` in config.toml. Per the signing-keys guidance, this should be `false` with in-code validation (which it already does).
- Supabase SDK import uses unversioned `@supabase/supabase-js@2` -- could resolve to different versions over time.
- The 1000-row default query limit from Supabase isn't handled on the contacts insert -- large CSVs could silently truncate.
- DNC checking is bundled into the import function, which contradicts the established memory about CSV workflow separation (though it runs post-insert, not blocking).

#### 4. MINOR -- Inconsistencies across all four
- Three different Supabase SDK versions: `@2.7.1`, `@2.53.0`, `@2`.
- Two different auth patterns: `getUser()` vs `getClaims()`.
- Two different role-check methods: `profiles.role` vs `user_roles` table vs `get_current_user_role()` RPC.
- CORS headers defined locally in each file instead of importing from `_shared/cors.ts`.

---

### Proposed Fixes

**Step 1: Add all four functions to `config.toml` with `verify_jwt = false`**
- `admin-contacts-cleanup`, `admin-delete-user`, `admin-update-user-metadata` are missing entirely.
- `admin-contacts-import` should change from `true` to `false`.

**Step 2: Rewrite `admin-contacts-cleanup` auth**
- Add proper JWT-based auth using `getClaims()` from the Authorization header.
- Remove the trust-the-body `adminUserId` pattern.
- Check role via `get_current_user_role()` RPC instead of `profiles.role`.

**Step 3: Modernize `admin-delete-user` and `admin-update-user-metadata`**
- Switch from `getUser()` to `getClaims()` for auth.
- Switch from direct `user_roles` query to `get_current_user_role()` RPC.
- Pin SDK version to `@2.53.0` for consistency.
- Return proper HTTP status codes (`401` for no auth, `403` for wrong role).

**Step 4: Pin `admin-contacts-import` SDK version**
- Change `@supabase/supabase-js@2` to `@supabase/supabase-js@2.53.0`.

**Step 5: Standardize CORS headers**
- Import from `../_shared/cors.ts` in all four functions instead of defining locally.

---

### Summary Table

```text
Function                      Auth      Role Check         SDK Ver   config.toml   Status
─────────────────────────────────────────────────────────────────────────────────────────
admin-contacts-cleanup        NONE(!)   profiles.role      @2.53.0   MISSING       CRITICAL
admin-delete-user             getUser   user_roles direct  @2.7.1    MISSING       CRITICAL
admin-update-user-metadata    getUser   user_roles direct  @2.7.1    MISSING       CRITICAL
admin-contacts-import         getClaims get_current_role   @2        jwt=true      MODERATE
```

All four will be updated to: `getClaims()` + `get_current_user_role()` RPC + `@2.53.0` + `verify_jwt = false` + shared CORS.

