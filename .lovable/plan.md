

## Diagnosis: ClickUp & Social Media Backend Issues

### Findings

**1. ClickUp tasks data is stale** — last updated Feb 19 (3+ weeks ago)

The `clickup_tasks` table has 188 rows but hasn't been updated since Feb 19. There are two sync mechanisms:

- **Real-time webhook** (`clickup-webhook`): Triggered by ClickUp when tasks change. No recent logs at all, which means either:
  - The webhook is no longer registered with ClickUp (most likely — webhooks expire or get removed)
  - ClickUp isn't sending events (unlikely if tasks are being worked on)

- **Manual bulk sync** (`clickup-sync-event-tasks`): Admin-only function. **Not wired to any UI button** — there's no frontend code that calls this function. It can only be triggered manually via API.

- **Auto-link** (`clickup-link-events`): Same issue — no frontend code calls it.

- **Register & sync** (`clickup-register-and-sync`): Also has no frontend trigger.

**Root cause**: The ClickUp webhook likely expired or was deleted, and there's no scheduled cron job or admin UI button to trigger manual re-syncs. The `clickup-create-event-folder` function (called when events are created) works, but the ongoing sync pipeline is broken.

**2. Social Media functions are completely unused**

- `social_posts` table: **0 rows**
- `social_accounts` table: **0 rows**
- No logs for any social function (`social-posting`, `social-schedule`, `social-oauth`, `social-analytics`, `social-webhook`)

The social media page (`SocialScheduler.tsx`) uses **Metricool iframe** — it doesn't use the social edge functions at all. The `useSocialScheduler.ts` hook exists and calls `social-schedule`, but the actual page renders a Metricool iframe instead of the scheduler UI.

Additionally, `social-schedule` and `social-posting` use an outdated SDK version (`@supabase/supabase-js@2.39.3`) and the old `serve()` pattern.

**3. CORS headers are incomplete on social functions**

The social functions (`social-schedule`, `social-posting`) use a minimal CORS header set missing the newer Supabase client headers (`x-supabase-client-platform`, etc.), which could cause CORS failures from the frontend.

---

### Proposed Fixes

#### Fix 1: Add ClickUp Sync UI + Cron Job
- Add a "Sync ClickUp Tasks" button to the Admin Events Management page that calls `clickup-sync-event-tasks`
- Add a "Re-link Events" button that calls `clickup-link-events`
- Set up a pg_cron job to run `clickup-sync-event-tasks` every 2 hours automatically so data stays fresh even if the webhook breaks

#### Fix 2: Re-register ClickUp Webhook
- Add a "Register Webhook" button in Admin Events that calls `clickup-register-and-sync` to re-register the ClickUp webhook for real-time task updates

#### Fix 3: Update Social Media Functions
- Update `social-schedule` and `social-posting` to use `@supabase/supabase-js@2.53.0`, `Deno.serve()`, and the shared CORS headers from `_shared/cors.ts`
- These functions are technically working but unused since the Social Media page renders a Metricool iframe

#### Fix 4: Add Error Logging to getClaims Auth Blocks
- All 13 functions using `getClaims` silently return 401 without logging. Add `console.error` before each 401 return so failures are visible in logs for debugging.

---

### Priority Recommendation

The most impactful fix is **Fix 1** — adding the sync button and cron job to keep ClickUp tasks fresh. The social media functions are a lower priority since the actual social media feature uses Metricool, not the custom posting functions.

### Implementation Plan

| # | Change | Files |
|---|--------|-------|
| 1 | Add "Sync Tasks" and "Re-link Events" buttons to Admin Events | `src/pages/AdminEventsManagement.tsx` |
| 2 | Add pg_cron job for automatic ClickUp sync every 2 hours | SQL migration |
| 3 | Add x-service-key bypass to `clickup-sync-event-tasks` so cron can call it | `supabase/functions/clickup-sync-event-tasks/index.ts` |
| 4 | Update social functions to modern SDK + CORS | `supabase/functions/social-schedule/index.ts`, `supabase/functions/social-posting/index.ts` |
| 5 | Add error logging to getClaims auth blocks across all 13 functions | All affected edge functions |

