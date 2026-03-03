

## ClickUp Edge Functions Review: Findings

### Summary Table

```text
Function                            Server    SDK Ver   CORS       config.toml    Auth/Security       Severity
────────────────────────────────────────────────────────────────────────────────────────────────────────────────
clickup-create-event-folder         serve()   @2        local      jwt=false      NONE (open)         HIGH
clickup-generate-copy-webhook       Deno.serve @2       local      jwt=false      Webhook sig ✓       OK
clickup-generate-thumbnail-webhook  Deno.serve @2       local      jwt=false      Webhook sig ✓       OK
clickup-get-list-fields             serve()   (none)    local      jwt=false      NONE (open)         HIGH
clickup-get-team-members            serve()   (none)    local      MISSING        NONE (open)         HIGH
clickup-get-workspace-structure     serve()   (none)    local      jwt=false      NONE (open)         HIGH
clickup-link-events                 serve()   @2        local      jwt=false      NONE (open)         HIGH
clickup-register-and-sync           Deno.serve @2       local      MISSING        NONE (open)         HIGH
clickup-social-ready-to-schedule    Deno.serve @2       local      jwt=false      Webhook sig ✓       OK
clickup-sync-event-tasks            serve()   @2        local      jwt=false      NONE (open)         HIGH
clickup-webhook                     serve()   @2        local      jwt=false      Webhook sig ✓       OK
```

---

### Issue 1: CRITICAL -- 6 functions are completely unauthenticated admin tools

`clickup-create-event-folder`, `clickup-link-events`, `clickup-sync-event-tasks`, `clickup-get-list-fields`, `clickup-get-team-members`, `clickup-get-workspace-structure` have **zero authentication**. Anyone with the function URL can:
- Create ClickUp folders for any event
- Link/unlink ClickUp folders to Hub events
- Trigger a full ClickUp task sync
- Enumerate your entire ClickUp workspace structure, lists, and team members

These are admin-only operations. They should require a valid JWT + admin role check.

`clickup-register-and-sync` attempts to read the auth header for user lookup but doesn't reject unauthenticated callers. It also uses the deprecated `getUser(token)` pattern and is **missing from config.toml**.

**Fix:** Add JWT + admin role verification using `getClaims()` + `get_current_user_role()` RPC to all 6 admin functions, and add the 2 missing functions to `config.toml`.

---

### Issue 2: MODERATE -- `clickup-link-events` checks `clickup_folder_id` but doesn't SELECT it

Line 135 checks `matchedEvent.clickup_folder_id === folder.id`, but line 47 only selects `id, title, agent_id, event_date`. The field is never fetched, so `clickup_folder_id` is always `undefined` and the "already linked" check never matches. This means every run re-links all events, overwriting existing data.

**Fix:** Add `clickup_folder_id` to the select clause.

---

### Issue 3: MODERATE -- `clickup-link-events` uses `full_name` but profiles table has `first_name`/`last_name`

Line 54 selects `full_name` from profiles, but the profiles table schema uses `first_name` and `last_name` as separate columns. The `full_name` field is a generated/computed column and may not be directly selectable. If it returns null, the matching logic on line 119 (`fullName.split(" ")[0]`) will fail silently, causing all folders to go "unmatched".

**Fix:** Select `first_name` instead and use it directly for matching.

---

### Issue 4: MODERATE -- `clickup-sync-event-tasks` doesn't paginate ClickUp API

The task list endpoint (line 57) doesn't use pagination. ClickUp returns max 100 tasks per page by default. Events with more than 100 tasks will silently lose tasks. Compare with `clickup-register-and-sync` which correctly paginates (lines 114-136).

**Fix:** Add pagination loop similar to `fetchListTasks` in `clickup-register-and-sync`.

---

### Issue 5: MODERATE -- `clickup-sync-event-tasks` fetches ALL events with no filter

Line 28-30 queries all events with any ClickUp list ID. As the events table grows, this becomes increasingly expensive and slow, potentially timing out the edge function. There's no date filter to exclude past events.

**Fix:** Add a date filter (e.g., events from the last 90 days or future events only) to limit the sync scope.

---

### Issue 6: MINOR -- Duplicated helper code across 4 functions

`hexToBytes()`, `verifySignature()`, `getCustomField()`, `getCustomFieldValue()`, `fetchWithRetry()` are copy-pasted identically across `clickup-generate-copy-webhook`, `clickup-generate-thumbnail-webhook`, `clickup-social-ready-to-schedule`, and `clickup-webhook`. Changes to one must be manually replicated.

These can't be extracted to `_shared/` due to edge function bundling constraints, but worth noting for maintenance awareness.

---

### Issue 7: MINOR -- Inconsistent server patterns

3 functions use `Deno.serve()` (the modern pattern), 7 use `serve()` from `std@0.177.0` or `std@0.190.0` (deprecated). Two different std versions are in use (`0.177.0` vs `0.190.0`).

**Fix:** Standardize to `Deno.serve()` across all functions.

---

### Issue 8: MINOR -- All 10 functions define CORS headers locally

None import from `_shared/cors.ts`, and most are missing the extended `x-supabase-client-*` headers that were just standardized.

**Fix:** Import from `../_shared/cors.ts`.

---

### Issue 9: LOW -- `clickup-create-event-folder` list classification bug

Line 137: `name.includes("day") || name.includes("event day")` -- the second condition is redundant since "event day" always contains "day". More importantly, the check order matters: if a list is named "Pre-Event Day Setup", it would match "pre" first (correct), but "Post-Event Day" would also match "day" before "post" due to the `else if` chain.

Current list names ("Pre-Event", "Event Day", "Post-Event") work fine, but the logic is fragile.

---

### Proposed Fix Plan

1. **Add `clickup-get-team-members` and `clickup-register-and-sync` to `config.toml`** with `verify_jwt = false`.

2. **Add admin auth guards** to the 6 unauthenticated admin functions:
   - `clickup-create-event-folder`
   - `clickup-link-events`
   - `clickup-sync-event-tasks`
   - `clickup-get-list-fields`
   - `clickup-get-team-members`
   - `clickup-get-workspace-structure`
   Using the standardized `getClaims()` + `get_current_user_role()` RPC pattern.

3. **Fix `clickup-link-events`**:
   - Add `clickup_folder_id` to the SELECT
   - Change `full_name` to `first_name`

4. **Add pagination to `clickup-sync-event-tasks`** and add a date filter to limit scope.

5. **Standardize all to `Deno.serve()`**, shared CORS import, and pinned SDK version `@2.53.0`.

6. **Fix `clickup-register-and-sync` auth**: replace `getUser(token)` with `getClaims()`.

