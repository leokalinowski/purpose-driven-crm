# Decisions log

An append-only record of significant decisions and what shipped. One entry per merged PR. Newest first.

**Update rule:** when a PR merges to `main`, the same commit that closes the PR should add an entry here. If it doesn't, it's a follow-up. Never delete entries — supersede them with a new one and note the link.

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
