# Decisions log

An append-only record of significant decisions and what shipped. One entry per merged PR. Newest first.

**Update rule:** when a PR merges to `main`, the same commit that closes the PR should add an entry here. If it doesn't, it's a follow-up. Never delete entries — supersede them with a new one and note the link.

---

## 2026-05-18 — Frontend audit cleanup (Track C, PR TBD)

**What.** Five Track-C audit items from the same live-system audit. All UI/perf hygiene, no behavior changes for working flows.

**C1. Deleted 10 dead dashboard components.** `1,163 lines removed` — every one verified zero-importer:
- `WeeklyTouchpoints`, `WeeklyTasksBySystem`, `TaskPerformance`, `OverdueTasks`, `TransactionOpportunity`, `AgentIntelligenceWidget`, `RecentActivity` (note: NOT `RecentActivityFeed`, which IS used), `ExportButtons`, `NewsletterCadenceBanner`, `TabSummaries`

The live dashboard imports `CommanderHero`, `StreakCard`, `Modules`, `RecentActivityFeed`, `UpcomingEvents`, `JumpBackIn`, `DashboardRefreshButton`. The 10 deleted files were vestigial from earlier dashboard iterations; the audit caught the dust.

`AgentIntelligenceWidget` is the "computed but not rendered" Coach surface CLAUDE.md flagged — confirmed unused, deleted. If we want to bring AI intelligence to the dashboard later, build it fresh against the current `agent_intelligence_snapshots` schema instead of resurrecting an orphaned component.

**C2. Filter-chip focus rings on Database.** All 7 filter checkboxes in `src/pages/Database.tsx` had `accent-primary` (which colors the check mark) but no focus outline. Keyboard navigation through the filter rail was invisible. Added `focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 rounded-sm` to every instance.

**C3. Mobile pagination 30×30 → 44×44.** All 9 pagination buttons in Database (prev/next + page numbers + ellipsis spacer) were 30×30, below WCAG/HIG's 44px tap-target minimum. Made the size responsive: `w-[44px] h-[44px] md:w-[30px] md:h-[30px]` — full size on mobile, original on `md:` and up where pointer input doesn't need the extra hit area.

**C4. PrioritiesTab Refresh button 28px → 44px on mobile.** Same fix pattern: `h-[44px] md:h-[28px]`.

**C5. Route lazy-loading.** `src/App.tsx` was eagerly importing ~50 page components into the first chunk. Bundle before: `3,054 KB / 810 KB gzip` (Vercel's chunk-size warning had been firing for weeks). Split into:
- **Eager** (loaded on first paint): `Auth`, `Index`, `SphereSyncTasks`, `Database`, `Pipeline`, `NotFound` — the agent's actual landing surface
- **Lazy** (`React.lazy()`): everything else (admin pages, Settings, Newsletter, Newsletter builder, public RSVP, detail pages, etc.)

Bundle after: `1,181 KB / 336 KB gzip` initial chunk (**-61% / -58%**). Lazy chunks: tiny (5–80 KB each) for low-traffic routes; one fatter ~365 KB chunk for `BarChart` (recharts) that's used by dashboard widgets, and a ~214 KB `SocialScheduler` chunk for the Metricool surface.

A simple `<Suspense fallback={<RouteFallback />}>` wraps every lazy route — fallback is a small centered spinner. Real-world chunk loads finish in <300ms on warm cache.

**What's NOT done (still on the audit board):**
- `src/lib/comm.ts:45` raw-error toast leak (Frontend Critical #3) — would have stretched this PR
- WeekHintBar key fragility (Medium) — defensive, no current bug
- StreakCard color-only state (Medium, a11y)
- HomeRoute is a no-op wrapper — `/` always renders `<Index />` for everyone (may or may not be desired; needs Pam/Leo decision before changing)
- vite `manualChunks` config (the remaining ~1.18 MB initial chunk could be split further into vendor/react/etc.)

**Files.** −1,163 / +106 across:
- DELETED: 10 dashboard component files
- MODIFIED: `src/App.tsx`, `src/pages/Database.tsx`, `src/components/spheresync/tabs/PrioritiesTab.tsx`

**Verification.** `bun run build` clean, bundle size confirmed dropped (see above). No type errors. No behavior changes for any working flow — pure dead-code removal + accessibility + perf.
## 2026-05-18 — CORS tighten + sync-realtor dedupe backport (PR TBD)

**What.** Audit item B6: every edge function shipped with `Access-Control-Allow-Origin: *`, which lets a malicious page in another tab read the response of any function. PR ships two things together:

1. **Origin-aware CORS helper.** `supabase/functions/_shared/cors.ts` now exports `buildCorsHeaders(req)` — echoes the request `Origin` back if it's in a closed allowlist (`https://hub.realestateonpurpose.com`, `http://localhost:5173`, `http://localhost:5174`, plus an optional `ALLOWED_ORIGINS` env var for temporary additions). Anything else gets the prod hub origin, which the browser rejects. The legacy static `corsHeaders` wildcard is kept as a deprecated export for the 44 inline-cors functions not yet migrated (follow-up PR).

2. **28 edge functions migrated** from `corsHeaders` → `buildCorsHeaders(req)` on disk. Local helpers like `jsonResponse(body)` that closed over the old static were refactored to take `req: Request` as the first parameter; every call site updated to pass `req`. **25 of 28 deployed live** via MCP. Three pending operator action (see below).

3. **Bonus: `sync-realtor-market-data` dedupe backport.** While inspecting that function for cors migration, found a live-vs-disk drift: live v5 has a `dedupe()` function (with `dropped` accounting in the response) added as an April-2026 hotfix because Realtor.com's CSV occasionally has duplicate `(zip_code, period_month)` pairs that crash Postgres' `ON CONFLICT` ("cannot affect row a second time"). The hotfix never made it back to disk. Backported to disk + applied cors migration. **Not deployed** — same operator-action queue as the spheresync functions.

**The 3 functions NOT yet deployed live (disk is correct, deploy is pending):**
- `spheresync-email-function` (854 lines)
- `spheresync-generate-tasks` (549 lines)
- `sync-realtor-market-data` (336 lines, includes dedupe backport)

**Why deferred.** The Supabase MCP `deploy_edge_function` tool requires file content inline. For files in the 500+ line range the LLM-mediated round-trip becomes error-prone (a sub-agent shipped a condensed `generate-ai-newsletter` once, losing ~400 lines of prompt detail before it was caught and redeployed). To deploy safely, run from a terminal with the Supabase CLI:

```bash
export SUPABASE_ACCESS_TOKEN=<token>
bunx supabase functions deploy spheresync-email-function --project-ref cguoaokqwgqvzkqqezcq --no-verify-jwt
bunx supabase functions deploy spheresync-generate-tasks --project-ref cguoaokqwgqvzkqqezcq --no-verify-jwt
bunx supabase functions deploy sync-realtor-market-data --project-ref cguoaokqwgqvzkqqezcq --no-verify-jwt
```

Until those run, the 3 functions keep using the wildcard cors helper bundled with their previous deploys (the prod runtime is bundle-snapshotted at deploy time — disk changes don't take effect until redeploy). Behavior is unchanged; just CORS isn't tightened yet on those 3.

**The 44 inline-cors functions (out of scope here).** Mostly webhooks (Stripe, ClickUp, Resend, OpenToClose — server-to-server, no browser CORS surface), cron-only functions (already gated by `requireCronAuth` from PR #35), and a few legacy edge functions. Tracked as a follow-up.

**Files.** 1 helper + 28 function migrations + 1 dedupe backport = 30 files, +368 / −247 lines.

**Verification.** `bun run build` clean. 25 functions verified deployed via MCP. Spot-check: cron command path to `coaching-weekly-nudge` (CORS-tightened in this PR) still returns `200 {ok:true,...}` from PostgREST cron — confirms server-to-server doesn't trip the browser CORS gate.

---

## 2026-05-18 — Security audit: high-tier batch (PR #37)

**What.** Five audit items from the same live-system audit that produced PRs #35 (critical auth) and #36 (priority cleanup). Each was a real exposure or schema drift — none were ship-blockers individually, but together they close most of the high-tier surface area.

**B1. `create-checkout` priceId whitelist.** The function accepted any `priceId` and passed it straight through to `stripe.checkout.sessions.create`. Any caller could launch a Checkout session for any price that exists in our Stripe account — including test-mode prices in prod, arbitrary upsell pricing, or cross-product prices — and receive a `success_url` redirect with a tier-less subscription. Fix: hard-reject if `priceId` isn't in `FOUNDER_PLANS` or `STANDARD_PRICE_TIERS`. Deployed live as v41.

**B2. `event_rsvps` public INSERT: drop policy + harden RPC.** The `Public can create RSVPs` PostgREST policy was vestigial — the frontend stopped using direct INSERTs long ago in favor of the `submit_public_rsvp` RPC. The RPC itself had no email validation, no length caps, and no rate limit. Migration `20260518000005`:
- Drops the policy
- Re-creates the RPC with email format regex, length caps (email ≤ 250, name ≤ 200, phone ≤ 50, guest_count 1–20), and a per-event 30-RSVPs-per-5-min throttle that cuts off enumeration attacks while leaving headroom for genuinely popular events
- No frontend change (same RPC signature)

**B3. SECURITY DEFINER views: REVOKE from anon + authenticated.** Five views (`delight_opportunities_v`, `v_agent_coaching_state_summary`, `v_coach_scheduling_jobs`, `v_coach_task_ttl_jobs`, `v_priority_rescore_jobs`) were created `SECURITY DEFINER` AND granted full CRUD to `anon` + `authenticated`. The most exploitable: `delight_opportunities_v` exposed every agent's contact PII (name + birthday + spouse_birthday + home_anniversary + gift_preferences) to anyone with the anon key via `curl https://<project>.supabase.co/rest/v1/delight_opportunities_v`. Migration `20260518000006` REVOKEs ALL on all 5 from anon + authenticated; service_role keeps full access (the only legitimate caller is `delight-daily-nudge` cron). Frontend audit (`grep -rn` over `src/`) confirmed zero consumers besides that one cron edge function.

**B4. Storage: drop 5 public LIST policies + flip `newsletter-csvs` to private.** Migration `20260518000007`:
- Drops `Public can view agent assets`, `Public can view backgrounds`, `Public read access for assets`, `Public read access for newsletter assets`, `Anyone can view sponsor logos` on `storage.objects`. For `public:true` buckets, direct URL fetches via `/storage/v1/object/public/<bucket>/<path>` bypass RLS anyway — these policies only enabled `storage.objects.list()` enumeration. Frontend audit confirmed zero `.list()` callers; every consumer is `getPublicUrl()` (pure client-side string concat).
- Flips `newsletter-csvs` bucket from `public:true` to `public:false`. Only writer is the `upload-csv` edge fn (service_role); no consumer fetches CSVs by URL after upload. Was world-fetchable with the bucket+filename, leaking uploaded contact-list CSVs to anyone who could guess a path.

**B5. `contacts.priority_band` CHECK constraint.** Tightened the allowlist from `('pipeline','cadence','engagement','sphere')` to `('pipeline','cadence')`. Live data was already clean (0 rows in the dropped buckets); the migration fixes schema-vs-code drift so a future scorer bug that writes `'engagement'` fails closed instead of slipping through.

**Files.**
- `supabase/functions/create-checkout/index.ts` — v41 (deployed).
- `supabase/migrations/20260518000005_event_rsvps_throttle.sql`
- `supabase/migrations/20260518000006_lockdown_security_definer_views.sql`
- `supabase/migrations/20260518000007_storage_lockdown.sql`
- `supabase/migrations/20260518000008_tighten_priority_band_check.sql`

**Verification.** All 4 migrations applied live via MCP; smoke verified: `submit_public_rsvp` RPC rebuilt and callable, the 5 views show only `service_role` grants, `newsletter-csvs.public=false`, `contacts_priority_band_check` is the tight allowlist.

**What remains.** Track B still has: CORS `*` tightening (B6 — separate PR, touches many edge functions), operator action for leaked-password protection + OTP expiry (B7), multi-role gating in `get_current_user_role()` (B8 — deferred, no user has multi-role today). Track C (frontend cleanup) hasn't started.
## 2026-05-18 — Priority cleanup: kill half-migrated `priority_score` debris (PR TBD)

**What.** Audit item #4 from the same live-system audit that produced PR #35. The set-based priority rewrite (PR #34) left the old weighted-score readers in the tree, several of them visibly broken:

1. **`src/hooks/usePrioritizedContacts.ts` (199 lines)** — legacy 6-tier `TIER_META` scorer hook with red/orange/yellow/blue/slate buckets. Zero importers. **Deleted.**
2. **`src/components/commander/ActionCard.tsx`** — rendered the per-contact tier badge from `item.priority_score`. Zero importers. **Deleted.**
3. **`src/components/spheresync/ContactQuickSheet.tsx` lines 1949–2135 (186 lines)** — leftover Coach pane internals (`signalLabels`, `isMeaningful`, `humanizeSignalString`, `buildHumanSignals`, `SignalsView`, `COMPONENT_ORDER`, `ComponentBar` — the 5-weight bars with the "0.40 / 0.35 / 0.10 / 0.10 / 0.05" allocation). All orphaned; the current `CoachPane` is set-based. **Stripped.**
4. **`useCoachingState.ts`** — removed the `priority_score: number | null` field on `TodayItem`, plus the now-orphaned `tierFor()` helper and `PriorityTier` type (both consumed only by ActionCard + usePrioritizedContacts).
5. **`ContactQuickSheet.ContactRecord` type** — dropped `priority_score` + `priority_components` (no remaining reader inside the file).
6. **`useDatabaseStats.hotLeads`** — dropped the field entirely. It queried `.gte('priority_score', 60)` which is permanently `0` since the v7 scorer writes `priority_score=NULL` for every contact. The "Hot leads" tile it powered was already replaced by the "Priorities" tile that reads `usePrioritizedQueue().counts` directly — `hotLeads` had zero readers.
7. **`Database.tsx`** — fixed three stale comments that still said `priority_score >= 60`. The code was correct (reads `priorityQueue.contactIds`); the comments would have misled the next person to touch the file.

**Why.** The set-based rebuild was conceptually correct but shipped half-migrated. The audit caught the debris: a "Hot Leads" tile that's permanently 0, a Coach pane file with 186 lines of dead weight-bar internals that read like they were still live, and a 199-line `usePrioritizedContacts.ts` hook that returns nothing because every contact gets the `unscored` bucket. Each item by itself was small; collectively they were a "is this thing still wired?" trap for anyone touching the priority surface.

**What's left alone.** The `priority_score` + `priority_components` columns still exist in the DB (every row NULL). The `supabase/integrations/supabase/types.ts` rows for them are auto-generated and not hand-editable. A follow-up migration can `ALTER TABLE contacts DROP COLUMN priority_score, DROP COLUMN priority_components` once we're confident no external integrations read them — separate concern, not blocking.

**Files.**
- DELETED: `src/hooks/usePrioritizedContacts.ts`, `src/components/commander/ActionCard.tsx`
- MODIFIED: `src/components/spheresync/ContactQuickSheet.tsx` (–186 lines), `src/hooks/useCoachingState.ts`, `src/hooks/useDatabaseStats.ts`, `src/pages/Database.tsx`

**Audit alignment.** Closes Frontend-Critical #1, #2, #4, Backend-Critical #1, Backend-High #9. Remaining audit items (security high tier, broader frontend cleanup) tracked separately.

---

## 2026-05-18 — Security audit: critical auth gates (PR #35)

**What.** Closed three categories of auth holes uncovered in the live-system audit:

1. **Stripe webhook signature verification.** Production `stripe-webhook` v41 had a fallback branch that accepted unsigned payloads when `STRIPE_WEBHOOK_SECRET` was unset (`else { JSON.parse(body) }`). Deployed v42 that returns 400 instead — any unsigned call now fails closed. Secret is set in production.

2. **`make-agent-webhook` PII leak.** Function was deployed with `verify_jwt: false`, no role check, and forwarded the full agent profile (email, phone, license, brokerage, GCI goal) to a Make.com scenario URL. UUIDs were enumerable (19 agents). Deployed v115 with `verify_jwt: true`, JWT validation, role gate (admin or editor only — mirrors the `EditorLanding.tsx` page gate), and UUID format check.

3. **Unauthenticated cron + admin functions (8 total).**
   - **3 manual-send-* functions** (`coaching-reminder`, `event-email`, `spheresync-email`) — all triggered org-wide email blasts and were callable by anyone with the URL. Now `verify_jwt: true` + admin-role check via `get_current_user_role()`.
   - **5 cron-triggered functions** (`coaching-reminder`, `coaching-weekly-nudge`, `delight-daily-nudge`, `event-email-scheduler`, `event-reminder-email`, `dnc-monthly-check`) — were gated only by the trivially-spoofable `X-Cron-Job: true` header. Now require `X-Cron-Secret` matching the `CRON_SHARED_SECRET` env var, with a backward-compat fallback to the legacy header while the env var is unset (zero-downtime rollout).

**The shared helper.** `supabase/functions/_shared/authGuards.ts` exports `requireCronAuth(req)` and `requireAdminAuth(req, url, key)`. Both return `null` on success or a 401/403 `Response` for the caller to return directly. Centralized so the next sensitive function can opt in with a one-line import.

**The cron secret rollout.** Designed lenient-then-strict so the four steps could happen in any order without breaking cron:

1. Deploy the hardened functions (in-body `requireCronAuth`).
2. Apply `20260518000004_cron_shared_secret_headers` — `cron.alter_job` updates the 8 `net.http_post` commands to add `X-Cron-Secret` header reading from Supabase Vault: `coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_shared_secret' LIMIT 1), 'unset')`.
3. Operator runs `SELECT vault.create_secret(...)` once to populate the vault row.
4. Operator sets `CRON_SHARED_SECRET` env var on the Edge Functions runtime to the same value.

Until step 3+4 both land, the cron command sends `X-Cron-Secret: 'unset'` and `requireCronAuth` falls back to the `X-Cron-Job` legacy check. After both are set, strict mode engages — invalid/missing secret returns 403.

**Why Vault, not `ALTER DATABASE ... SET`.** First draft of the migration used `current_setting('app.cron_shared_secret', true)` and asked the operator to `ALTER DATABASE postgres SET app.cron_shared_secret = '...'`. Supabase managed Postgres denies that ALTER for custom GUC namespaces (`ERROR: 42501: permission denied to set parameter`). Vault is the supported path on this platform.

**Verification.** End-to-end smoke tested with a one-off `cron-secret-debug` edge function that returned byte-level fingerprints (length, prefix, suffix, leading hex, trailing hex, whitespace flags) of both `Deno.env.get("CRON_SHARED_SECRET")` and the incoming `X-Cron-Secret` header. Confirmed exact 40-byte match. Then invoked `coaching-weekly-nudge` through the full cron command path: valid secret → `200 {"ok":true,"skipped":"today is not a configured nudge day"}`, bogus secret → `403 {"error":"Forbidden: invalid or missing cron secret"}`. Diagnostic function neutered (verify_jwt: true + 410 stub) for later dashboard deletion.

**Key files.**
- `supabase/functions/_shared/authGuards.ts` — `requireCronAuth` + `requireAdminAuth` helpers.
- `supabase/functions/make-agent-webhook/index.ts` — v115.
- `supabase/functions/manual-send-{coaching-reminder,event-email,spheresync-email}/index.ts` — v131/v133/v132.
- `supabase/functions/{coaching-reminder,coaching-weekly-nudge,delight-daily-nudge,event-email-scheduler,event-reminder-email,dnc-monthly-check}/index.ts` — all redeployed with `requireCronAuth`.
- `supabase/migrations/20260518000004_cron_shared_secret_headers.sql` — `cron.alter_job` × 8 to add the header.

**Why now.** Same-day cleanup after the priority-rebuild merge (PR #34). The audit ran on the same live snapshot and these three items were ship-blockers — Stripe in particular was actively dangerous (an attacker who guessed the function URL could send arbitrary fake events and free-mint subscriptions).

---

## 2026-05-18 — Priority system: set-based rebuild + UI overhaul (PR #34)

**SUPERSEDES** the 0–100 weighted-score model from PRs #31 (backend) and #32 (frontend). Those PRs are closed; this one is the canonical rebuild.

**What.** Threw out the weighted score entirely. A contact is now a PRIORITY iff:

1. **Pipeline** — has an active opportunity at `conversation_active`, `opportunity_identified`, or `consultation_completed`. Later stages (`client_secured`, `active_opportunity`, `under_contract`) are NOT priorities — the client is already engaged.
2. **Cadence** — `contacts.category` matches THIS week's call or text rotation AND no completed `spheresync_tasks` row for the current week.

No score. No engagement set. No carryover from last week. No weighted blend. The earlier formula confused more than it helped — when cadence-only contacts could outscore a real pipeline opportunity, the agent stopped trusting the number.

**Ordering within the queue:**
- Pipeline contacts first, sorted: `conversation_active` → `opportunity_identified` → `consultation_completed` (early stages first per the FLIP — agents forget the unsecured contact, not the one already moving)
- Within band: contacts NOT touched this week come BEFORE touched ones (touched contacts get a muted name + green "✓ Touched this week" chip; they stay visible but drop in rank)
- Then cadence by last-touch ASC

**"Touched this week" semantics.** Real touches only — calls, texts, emails, gifts logged in `contact_activities` with `outcome IS NOT NULL`, OR `outcome IS NULL` but `notes` doesn't start with `'SphereSync '`. The earlier version read `contacts.last_activity_date` directly and got fooled by SphereSync task STUB rows that the Monday-morning cron stamps onto every cadence contact.

**Database page rewrite.** Killed the 6-tier Temperature column + filter — agents never trusted it. Replaced with a single SphereSync filter rail (panini design):
- "On the Priorities list" (union of pipeline + cadence)
- "Calling this week · R, V" (current call letters)
- "Texting this week · O" (current text letter)
- "Touched this week"

PRIORITIES tile shows `N · X pipeline · Y cadence`. SPHERESYNC column shows a single "PRIORITY" badge per row. The useless single-value RELATIONSHIP filter auto-hides when every contact has the same `contact_type`.

**ContactQuickSheet Coach pane** rewritten. Gone: the 0–100 hero number, the 5 weighted-component bars, the "Refresh score" button. New: "Priority status" — a checklist of which sets the contact is in ("Active opportunity · Consultation completed" / "Week 21 call rotation · letter R"), or a plain "Not on the Priorities list right now" line for non-priorities.

**Event-driven rescore.** `usePipeline` now fires `compute-priority-scores` for the affected contact after every opportunity create / update / updateStage / delete + invalidates the priorities cache. A new opp appears on the Priorities tab in ~1 second, not at the next 6h cron tick.

**DB integrity fix.** New trigger on `spheresync_tasks` ensures `completed_at` is set whenever `completed=true` (and cleared when un-completed). Fixed a dashboard bug where 6 of Leo's completed calls had NULL `completed_at` and the "Sphere touches" KPI silently showed 0/17 instead of 6/17. Backfill migration stamps existing NULL rows with the SUNDAY of their assigned ISO week (NOT `NOW()` — that would pull historical completions into "this week").

**Non-priority UI improvements bundled in:**
- **Events page**: clicking "Calendar view" now hides the featured-event hero + mini-cal and shows a single full-width calendar at the top. Button toggles label between "Calendar view" ↔ "List view".
- **EventForm**: the "Publish Public RSVP Page" toggle is now a highlighted teal callout with a URL preview when ON (was a generic field row, easy to miss).

**Key files.**
- `supabase/functions/compute-priority-scores/index.ts` — set-based-v7 classifier (deployed live as version 11)
- `supabase/migrations/20260518000001_priority_system_rebuild.sql` — `priority_band` column, cron consolidated (carried over from PR #31)
- `supabase/migrations/20260518000002_priority_rescore_chunked_rpc.sql` — RPC batches to 100 IDs per pg_net call
- `supabase/migrations/20260518000003_spheresync_task_completed_at_integrity.sql` — trigger + safe backfill
- `src/hooks/usePrioritizedQueue.ts` — set-based, band-hierarchy sort, touched-this-week from real activities
- `src/hooks/useCompletedSphereTouchesThisWeek.ts` — exposes `touchedContactIds: Set<string>`
- `src/hooks/usePipeline.ts` — event-driven rescore on every opportunity mutation
- `src/pages/Database.tsx` — SphereSync filter rail + PRIORITIES tile + SPHERESYNC column
- `src/components/spheresync/ContactQuickSheet.tsx` — Coach pane rewritten as priority-status checklist
- `src/components/spheresync/tabs/PrioritiesTab.tsx` — touched-this-week chip, untouched-first focus pick
- `src/pages/Events.tsx` — Calendar view toggle behavior
- `src/components/events/EventForm.tsx` — highlighted RSVP toggle

**Source.** Live iteration with Leo on 2026-05-18 evening. Multiple frustrated rounds — got it wrong several ways before landing on the simple contract: "A contact is a priority if they're in the pipeline OR up in this week's rotation. Nothing else. No score." Then layered the touched-this-week behavior for the demote / drop-off effect.

---

## 2026-05-18 — Visual polish: ContactTable initials + WeekHintBar (PR #33)

**What.** Two small visual upgrades cherry-picked from the PR #26 audit (which itself was closed as superseded — see audit comments on that PR for the full triage).

1. **ContactTable mobile cards: initials avatar** instead of the generic `<User />` icon. New `getInitials(first, last)` helper at the top of `src/components/database/ContactTable.tsx`. The avatar is a 36px teal-soft circle with bold uppercase initials — same visual language as the Avatar pattern used in `PrioritiesTab` and `ContactQuickSheet`. Mobile cards now feel like individual people rather than identical "User icon + name" rows.
2. **`WeekHintBar` shared component** at `src/components/spheresync/WeekHintBar.tsx`. Renders the "Week N rotates letters A, B, C (calls); texts go to D" banner with letter chips. Accepts an optional `weekNumber` prop (defaults to the current ISO week) so the same component can serve other rotation views in the future. **Not wired in this PR** — `PrioritiesTab` is touched by the in-flight Phase 2 PR (#32) and I didn't want to create a merge conflict for a single-import line. Wiring is a 2-line follow-up.

**Why.** Audit of the older PR #26 ("Agent Ops HQ redesign") flagged these as the durable visual ideas worth keeping; the rest of #26 was superseded by the May 2026 dashboard/sidebar work or broke against Pam's 7 flat stages.

**Skipped from the original audit list.** The cadence stat-tile redesign — the existing `GoalBar` in `CadenceTab.tsx` is already clean, so the redesign was lower value-vs-scope than the other two.

**Source.** PR #26 audit report (recorded in the prior session); user direction to ship the surviving visual ideas as a small focused PR.

---

## 2026-05-18 — Priority system rebuild, Phase 2 — frontend swap (PR #32)

**What.** Frontend now reads the deterministic score + band the Phase 1 scorer writes, so every surface ranks contacts identically. No more parallel ranking systems.

- **`usePrioritizedQueue` rewritten.** Old 3-band client-side composer (3 separate queries + dedup) replaced with a single `SELECT ... ORDER BY priority_score DESC NULLS LAST` filtered by `priority_band IS NOT NULL`. Items are then grouped client-side by `band` for display. ~270 lines → ~170. Removes the broken `event_rsvps.contact_id` query that was silently erroring on main.
- **`PrioritiesTab.buildFocusReasoning` deleted.** The FocusCard's reasoning sentence now comes from `item.reason` (i.e. `contacts.priority_reasoning`) — same sentence the ContactQuickSheet shows. One story per contact across the whole app, no more "FocusCard says X, drawer says Y."
- **`usePrioritizedContacts` type updated.** `priority_components` shape changed from `{relationship, pipeline, intent, flags}` (Grok era) to `{pipeline, cadence, engagement, relationship, flags}` (5-component blend). Added `priority_band` field. Old `ai_key_signals` kept as legacy field for any unscored-since-Phase-1 rows.
- **`ContactQuickSheet` Coach insight pane updated.** `COMPONENT_ORDER` rewritten for the new 5-component shape with new descriptions ("Cadence", "Engagement" added; "Intent" removed). `weightFor()` updated to 40/35/10/10/5 (with pipeline) and the proportionally-renormalized 0/58/17/17/8 (without). The existing `SignalsView` + `humanizeSignalString` + `buildHumanSignals` helpers were kept as-is — they parse generic strings and structural fields that survived the rebuild.
- **`src/integrations/supabase/types.ts`** — added `priority_band: string | null` to the `contacts` Row / Insert / Update types. Manual edit instead of full regen (full regen is 154KB; types.ts already has the schema and only this one column changed for the contacts table).

**Why.** Phase 1 wrote a real score to the DB, but `PrioritiesTab` and the Dashboard FocusCard ignored it — they re-derived a 3-band ranking client-side from 3 separate queries. The old derivation was also blind to the `priority_band` classifier and used `last_name.ilike` instead of `contacts.category` for cadence (two sources of truth for the same concept). Phase 2 cuts both — DB is the truth.

**Verified.** `bunx tsc --noEmit` clean, `bunx eslint <touched files>` clean (no new warnings), `bun run build` ✓ (existing chunk-size + dynamic-import warnings are pre-existing).

**Key files.**
- `src/hooks/usePrioritizedQueue.ts` — rewritten
- `src/hooks/usePrioritizedContacts.ts` — type updates
- `src/components/spheresync/tabs/PrioritiesTab.tsx` — removed `buildFocusReasoning`, use DB reason
- `src/components/spheresync/ContactQuickSheet.tsx` — `COMPONENT_ORDER` + `weightFor` for 5-component shape
- `src/integrations/supabase/types.ts` — `priority_band` on contacts (Row / Insert / Update)

**Source.** Continuation of the 2026-05-18 Phase 1 work. User direction: "make the new score visible everywhere."

---

## 2026-05-18 — Priority system rebuild, Phase 1 — backend (PR #31)

**What.** Rewrote the contact prioritization scorer from scratch to make it the core piece of the product.

1. **New formula:** `0.40·pipeline + 0.35·cadence + 0.10·engagement + 0.10·relationship + 0.05·flags`. Pipeline weight redistributes proportionally when no active opportunity.
2. **Pipeline stage map FLIPPED** — Pam's 7 stages with EARLY stages weighted HIGHER (agents forget the `conversation_active` lead, not the one under contract): `conversation_active`=90, `opportunity_identified`=85, `consultation_completed`=80, `client_secured`=50, `active_opportunity`=40, `under_contract`=25, `closed`/`lost` excluded. Stale-in-stage penalty: −15 after 14d, −25 after 30d.
3. **Cadence is now a real input** — reads `contacts.category` against this week's `SPHERESYNC_CALLS ∪ SPHERESYNC_TEXTS` and `spheresync_tasks` completion for current + previous ISO week.
4. **Engagement is now a real input** (low weight): gifts in last 30d, email-matched event RSVPs in last 90d, recent logged activity.
5. **Grok dropped** — deterministic reasoning string built from the dominant component. Same "why this contact" on every UI surface. The Grok intent call was costing money to produce a sentence the FocusCard never even read.
6. **`priority_band` column** added to `contacts` (`pipeline | cadence | engagement | sphere`). UI surfaces group consistently without re-deriving.
7. **Cron consolidated** — 4 tiered jobs (hot daily / warm weekly / cool biw / cold monthly) replaced with one `priority-rescore-all-6h`. Cadence depends on ISO week → must refresh weekly anyway.
8. **RPC chunked at 100 IDs per pg_net invocation.** The old 200-row cap was protecting us from PostgREST URL-length overflow; chunking inside the RPC fixes it properly.

**Why.** Two parallel ranking systems existed — `compute-priority-scores` (only Database page read it) and `usePrioritizedQueue` (client-side 3-band composer, ignored `priority_score`). They never agreed. The scorer ignored Pam's 7 stages (still mapped legacy `new_lead`/`active_search`/etc), ignored the SphereSync rotation, ignored marketing engagement, and burned ~3,000 Grok calls/day to write reasoning the visible UI threw away. A prior branch (`claude/compassionate-panini-8202be`) tried to fix this client-side-only — got engagement wrong, broke on a non-existent `event_rsvps.contact_id`, and left the backend running unused.

**Method.** Two parallel audit agents (one post-morteming the prior branch, one mapping current code + live DB). Then a fresh rebuild on `feat/priority-system-rebuild` off `origin/main`. Deployed + verified live: 3,380/3,380 contacts scored on `deterministic-v2`. 3 in `pipeline` band (matches the 3 active opportunities production-wide; `conversation_active`=46 vs `active_opportunity`=31 — the FLIP works). Per-agent tops are all "Week N rotation (letter X) — owed a touch this week."

**Key files / migrations.**
- `supabase/functions/compute-priority-scores/index.ts` — full rewrite, no Grok, +`priority_band`
- `supabase/migrations/20260518000001_priority_system_rebuild.sql` — column add, cron consolidation, cap raised
- `supabase/migrations/20260518000002_priority_rescore_chunked_rpc.sql` — chunk RPC to 100 IDs per pg_net invocation

**Decisions baked in.**
| # | Question | Picked |
|---|---|---|
| 1 | Backend scorer or client-side? | Backend (browser shouldn't re-rank 3,400 contacts on every page) |
| 2 | Weights | 40 / 35 / 10 / 10 / 5 |
| 3 | Stage map direction | EARLY stages weighted HIGHER |
| 4 | Grok intent | Dropped. Deterministic reasoning. |
| 5 | Marketing engagement data pipeline | Deferred to Phase 4 (no per-contact opens/clicks captured today) |
| 6 | Cron tiering | Dropped. Single 6h all-rescore. |
| 7 | RPC chunking | 100 IDs per batch (PostgREST URL limit) |

**Scope note.** Backend only. `Database` page already reads `priority_score`, so the new scores are visible there immediately. `PrioritiesTab` still uses the old client-side `usePrioritizedQueue` composer — that swap is **Phase 2**: read `priority_score` + `priority_band` directly, delete `buildFocusReasoning`, restore the deleted `SignalsView` in `ContactQuickSheet`.

**Source.** User feedback: "the priority system should take into account the correct stages of the pipeline, the weekly cadence and in a lesser weight marketing engagement" + "contacts should be prioritized higher before they are secured, active, and under contract" (the FLIP).

---

## 2026-05-14 — System architecture doc + working-notes foundation (PR #29)

**What.** Added three foundational docs so future sessions don't start cold:
- `docs/SYSTEM_ARCHITECTURE.md` — ~7,000-word partner-readable architecture write-up. Cadence, temperature scoring, pipeline, AI Coach (with honest "wired vs parked" notes), Scoreboard, Newsletter/Delight/Events, scheduled jobs, security.
- `docs/SYSTEM_ARCHITECTURE.pdf` — 22-page PDF rendered via `markdown` + `reportlab`. For sharing with partners outside GitHub.
- `CLAUDE.md` at the repo root — dense working notes auto-loaded into every Claude Code chat. Conventions, file map by feature, brand tokens, gotchas, current state.
- `docs/DECISIONS.md` — this file.

**Why.** Knowledge was scattered across user-level memory entries (some stale by months), git commit messages, and Slack/email threads. New chats started cold on project conventions, leading to repeated mistakes ("which CRM column is the source of truth for brand colors?", "why is 'deal' replaced everywhere?"). The three-layer foundation (repo CLAUDE.md → docs/SYSTEM_ARCHITECTURE → docs/DECISIONS) is loaded automatically and stays current per the update rule above.

**Method.** Five parallel research agents mapped: cadence + priority + AI Coach + cron jobs + page inventory against the live codebase. Every claim grounded in file:line refs or live DB queries.

---

## 2026-05-14 — Pam's 7 pipeline stages (PR #28)

**What.** Replaced the buyer/seller/referral 3-set stage model with a single universal flat list of 7 stages per Pam's April 10 technical brief.

**New stage keys (in order):**
1. `conversation_active`
2. `opportunity_identified`
3. `consultation_completed`
4. `client_secured`
5. `active_opportunity`
6. `under_contract`
7. `closed`
8. `lost` *(8th, terminal, off-board by default)*

Plus `NULL` = sphere-only opportunity (in `opportunities` table but off the kanban).

**Key migrations / files:**
- Migration `supabase/migrations/20260514000001_pam_pipeline_stages.sql` — applied to live DB May 14
- `src/config/pipelineStages.ts` — rewritten flat. Dropped: `META_STAGES`, `STAGE_TO_META`, `getStagesForType`, `defaultSubStage`, `getMetaStageForKey`, `subStageLabel`, `BUYER_STAGES`/`SELLER_STAGES`/`REFERRAL_STAGES`. Added: `PIPELINE_STAGES`, `StageKey`, `getAllStages()`, `getBoardStages()`, `getStageShortLabel()`.
- Updated consumers: `PipelineBoard`, `PipelineColumn`, `PipelineCanvas`, `StageLabel`, `StagePicker`, `OpportunityCard`, `AddOpportunityDialog`, `EditOpportunityDialog`, `OpportunityDetailV2`, `TodayOpportunityCard`, `usePipeline`, `usePipelineFilters`, `components/dashboard/Modules.tsx`.

**Decisions baked in (from approval round):**
| # | Question | Picked |
|---|---|---|
| 1 | Lost stage | (a) Keep as 8th terminal, off-board |
| 2 | Nurturing | (c) Sphere-only via NULL stage — drops NOT NULL on `opportunities.stage` |
| 3 | `active_deal` → `active_opportunity` | Yes (consistent with deals→opportunities rename) |
| 4 | Buyer/seller stage granularity | OK to lose column-level distinction (still tracked via `opportunity_type` badge) |
| 5 | Board layout | 7 fixed-width 200px columns + horizontal scroll fallback below ~1100px |
| 6 | Stage history | (a) Rewrite in place, no timestamp churn — used `DISABLE TRIGGER USER` to suppress side-effects |
| 7 | Detail card | Keep as-is — no UI redesign |

**Trigger fix.** `log_opportunity_stage_change()` updated to skip the history INSERT when `NEW.stage IS NULL` (the column became nullable; without this, "move card back to sphere-only" would crash on the NOT NULL `to_stage` constraint).

**Migration verification.** Against live DB: 6 opportunities remapped (2 conversation_active, 2 active_opportunity, 1 sphere-only, 1 closed); 21 history rows rewritten in place; 0 unmapped values.

**Source.** Pam's April 10 email "the whole chat with Claude.ai" — SphereSync Pipeline Technical Build Brief, Step 1 stage list. UI column labels (ALL-CAPS short) and badge labels (sentence case) taken from her April 9 screenshots in "Pipeline (conversion engine!)" email.

---

## 2026-05-13 — Dashboard rebuild, Settings overhaul, opportunities terminology (PR #27)

**What.** Multi-week sweep across the Hub. One commit, three major surfaces:

### Dashboard rebuilt as Commander Home

- Matches `design/dashboard-v2.html` reference.
- New components: `CommanderHero` (dark-blue band, 4 KPI cells, agent-only greeting), `StreakCard` (call-streak with 7-week grid), `Modules` (Sphere touches / Pipeline value / Delight sent), `RecentActivityFeed` (no `outcome IS NOT NULL` filter, honest verbs like "Dialed X" vs "Talked with X"), `UpcomingEvents`, `JumpBackIn` (role-aware via `useFeatureAccess`).
- Removed: `CoachAlertsStrip`, `PriorityQueueCard`, `StuckDealsRow`, `WeekStatusCard`, `SphereHealthRow`, `DelightRow`, `UpcomingAndCadence` (over-built); plus orphaned `DashboardCards`, `DashboardCharts`, `PipelineLiveWidget`.
- KPIs from real queries — no fake sparklines, no fabricated trends. Conversations YTD replaced GCI YTD on the hero (GCI was unreliable: `transaction_coordination` only has data for 5/19 agents, `opportunities.gci_actual` is universally empty).
- Sphere touches KPI = calls + texts (not just calls).
- Coach `next_hour.first_sentence` is rendered as a "Suggested opener" chip, NOT as the page headline (it caused the "Hi Brian" bug where a contact's name appeared as the greeting).

### Settings rewritten — 7 sections

- Profile / Brand / Goals / Notifications / Billing / Security / Data & export.
- New: `AssetUploader` (headshot + logos to `agent-assets` bucket), `useNotificationPrefs` hook, `useUserProfile.save()` method.
- New columns on `agent_marketing_settings`: `signature_block`, `sender_name`.
- New columns on `profiles`: `timezone`, `reminder_day`, `quiet_hours_start`/`_end`, `notify_email`, `notify_in_app`.

### Phase 0 dedup migration

`supabase/migrations/20260504000001_dedupe_profiles_brand_columns.sql` dropped 13 duplicate brand columns from `profiles` (primary_color, secondary_color, headshot_url, logo_colored_url, logo_white_url, gpt_prompt, brand_guidelines, example_copy, metricool_creds, clickup_editing_task_list_id, clickup_video_deliverables_list_id, shade_folder_id, editors) + 5 legacy capitalized columns + the empty `license_states` dupe.

**Critical: `agent_marketing_settings` is now the single source of truth for brand.** Don't read brand fields from `profiles` anywhere — they no longer exist.

Verified zero data loss: every profiles row whose brand column was non-NULL had an equal-or-fresher value in `agent_marketing_settings`.

### Deals → Opportunities terminology

Replaced ~50 user-facing "deal/deals" strings across 18 files with "opportunity/opportunities" / "closing" / "sale" / "transaction" as context dictated:

- "Active deal" → "Active opportunity"
- "X closed deals" → "X closings"
- "Deal Value" → "Estimated Value" (or "Sale Price" depending on context)
- "Avg Deal Velocity" → "Avg Time to Close"
- "Pipeline & deal tracking" → "Pipeline & opportunity tracking"

**Preserved as-is:**
- Internal TypeScript types: `interface Deal`, `DealStage`, `dealsByStage`
- DB column names: `deal_value`, `buyer_deal_breakers`
- Variable names: `setDealField`, `dealVelocity`, `const dealResults`
- The industry term **"Deal-breakers"** ("things a buyer won't accept") — different word usage
- Code comments

### Coaching cron timezone-aware

`coaching-weekly-nudge` now respects each agent's `notify_in_app` opt-out + `quiet_hours_*` window in their local `timezone` before inserting an action item. Uses `Intl.DateTimeFormat` per-agent. Handles wrap-around midnight windows correctly.

### Token cleanup

New tokens: `reop-green-soft`, `reop-hero-stat-bg/border/eyebrow/sub/trend`, `reop-warm-soft/fg`, `reop-surface-subtle/muted`. Removed all raw `hsl(...)` literals from the dashboard surface. Remaining `hsl(var(--reop-*) / X)` patterns are token-with-opacity (valid).

**Source.** Multiple user iterations: dashboard rebuild against `design/dashboard-v2.html`, settings overhaul as configuration center, opportunities rename per user request "Real Estate Agents don't like that term", coaching nudge timezone fix as part of Notifications wiring.

---

## Earlier merged work (summarized from `git log`)

These predate the working-notes foundation. Brief summaries from commit messages — see `git show <hash>` for full detail.

| Date | PR | Summary |
|---|---|---|
| 2026-05 | #25 | refactor(spheresync): unify Pipeline into SphereSync as 3-tab hub |
| 2026-05 | #24 | refactor(spheresync): AI-first Dashboard, scrap Commander page + banners |
| 2026-05 | #23 | feat(spheresync): recover Phase C + Phase D + Phase E UI onto main |
| 2026-04 | #22 | feat(spheresync): recover B3+B4+B4.1+B5+B5.7+B6 edge-function state onto main |
| 2026-04 | #21 | feat(spheresync): Phase E — Coach blurb in opportunity detail (stacks on Phase D) |
| 2026-04 | #20 | feat(spheresync): Phase D — Coach lenses on Pipeline + SphereSync (stacks on Phase C) |
| 2026-04 | #18 | feat(spheresync): B7 — useCoachingState React hook (UI entry point) |
| 2026-04 | #16 | feat(spheresync): B5.8 — daily TTL cleanup for stale Coach tasks |
| 2026-04 | #14 | feat(spheresync): B5.5 — source + coach_* columns on task tables |
| 2026-04 | #13 | fix(priority-score): filter out SphereSync task stubs from activity counts |
| 2026-04 | #9 | feat(spheresync): B2 — ai-coach-agent edge function skeleton |
| 2026-04 | #8 | feat(spheresync): B1 — agent_coaching_state table foundation |

---

## How to add an entry

Format:

```markdown
## YYYY-MM-DD — Short title (PR #N)

**What.** One paragraph summary of the change.

**Why.** One paragraph on the motivation / problem solved.

**Key files / migrations.** Bullet list of the most important paths.

**Decisions baked in.** Any approval-round answers, table-format if multiple.

**Source.** Whose request / what design ref / what email — so future-me can trace context.
```

Keep it brief. The goal is to be searchable, not exhaustive. Code is the ultimate truth — this log explains the "why".
