## ClickUp & Social Media Backend Fixes — COMPLETED

### What was done

1. **ClickUp Sync UI** — Added "Sync Tasks" and "Re-link Events" buttons to Admin Events Management page
2. **Service-key bypass** — `clickup-sync-event-tasks` now accepts `X-Cron-Job: true` header for automated calls
3. **pg_cron job** — ClickUp task sync runs automatically every 2 hours
4. **Social functions updated** — `social-schedule` and `social-posting` now use `Deno.serve()`, `npm:@supabase/supabase-js@2`, and shared CORS headers
5. **Error logging** — All 13 edge functions with `getClaims` now log errors before returning 401

### Files changed
- `src/pages/AdminEventsManagement.tsx` — sync buttons
- `supabase/functions/clickup-sync-event-tasks/index.ts` — cron bypass
- `supabase/functions/social-schedule/index.ts` — modernized
- `supabase/functions/social-posting/index.ts` — modernized
- 10 edge functions — added `console.error` to getClaims blocks
