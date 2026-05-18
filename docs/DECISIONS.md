# Decisions log

An append-only record of significant decisions and what shipped. One entry per merged PR. Newest first.

**Update rule:** when a PR merges to `main`, the same commit that closes the PR should add an entry here. If it doesn't, it's a follow-up. Never delete entries — supersede them with a new one and note the link.

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
