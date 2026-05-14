# CLAUDE.md — REOP Hub working notes

This file is loaded automatically into every Claude Code chat that starts in this repo. Keep it dense — under 400 lines. For full system depth read `docs/SYSTEM_ARCHITECTURE.md`. For "why was X changed?" read `docs/DECISIONS.md`.

---

## What this is

**Real Estate on Purpose (REOP) Hub** — a productivity platform for real estate agents. Three jobs in one app:

1. **Stay in touch with the sphere** — predictable weekly outreach cadence ("SphereSync").
2. **Move active opportunities forward** — kanban pipeline + AI Coach + activity logging.
3. **Hold the agent accountable** — weekly check-ins, YTD goals, streak ("Scoreboard").

Everything else (Delight, Newsletter, Events, Support) feeds one of those three loops.

**Audience:** real estate agents. They are mobile-first, time-pressed, non-technical. **Never show them raw JSON, internal stage keys, "error 400", or vendor names (ClickUp/Metricool/Resend) in the UI.**

---

## Who I'm working with

- **Leo Kalinowski** — CTO at REOP, also founder of **Shadow Karl AI** (separate company). Both are in his memory; don't confuse them.
- **Pam O'Bryant** — REOP CEO. Product/UX direction often comes from her (emailed screenshots, technical briefs). When the user references "what Pam said," check the inbox via the Gmail MCP — don't guess.
- **JJ Gagliardi** — REOP. Sometimes Cc'd on Pam's product emails.

User's working style:
- **Iterates fast.** Prefers "ship phase by phase" over big up-front plans.
- **Sharp about honesty.** "Don't be lazy", "you're making wrong assumptions" — feedback is direct. When uncertain, say so; don't invent.
- **Hates fabricated data.** No fake sparklines, no placeholder "+24%" trends, no hallucinated numbers. If a metric can't be backed by a real query, omit it or show an honest empty state.
- **Often pushes back on my recommendations.** Good thing. If I default to the safe option and they ask "why not X?", X is usually right.
- **Sarcastic about timing.** If I estimate "5 days" they'll roast me for it taking hours. Don't pad estimates.

---

## Tech stack at a glance

| Layer | Choice | Notes |
|---|---|---|
| Frontend | React + Vite + TypeScript | Deployed to **Vercel** (auto-deploy on merge to `main`) |
| Styling | Tailwind + shadcn/ui | Brand tokens in `src/index.css` + `tailwind.config.ts` |
| Data | TanStack Query | All Supabase queries flow through this for caching |
| Drag/drop | `react-dnd` + `react-dnd-multi-backend` | HTML5 desktop + touch mobile |
| Database | Supabase Postgres + RLS | ~60 tables, ~300 migrations |
| Edge functions | Supabase Deno runtime | ~70 functions under `supabase/functions/` |
| Auth | Supabase Auth | JWT in cookies; `auth.users.raw_app_meta_data.role` for tier |
| Email | Resend | Transactional + newsletter |
| AI — cheap/fast | xAI Grok (`grok-4-1-fast-reasoning`) | Priority intent scoring, Coach next-hour ticks |
| AI — slow/quality | Anthropic Claude (`claude-3-5-sonnet-20241022`) | Weekly intelligence snapshot, SphereSync task scoring |
| Billing | Stripe | Customer Portal (no hardcoded tier names) |
| Social | Metricool (proxied via edge function) | Agent tier and above |
| Transactions | OpenToClose (synced daily) | Admin-only surface |
| Market data | Realtor.com (monthly CSV) | Used for AI intent scoring |

**Two domains, two hosts:**
- `hub.realestateonpurpose.com` → **Vercel** (this app)
- `realestateonpurpose.com` → **Netlify** (separate marketing site — *not* this repo)

---

## Where things live (file map by feature)

```
Routes:             src/App.tsx
Sidebar nav:        src/components/layout/AppSidebar.tsx
Route gating:       src/hooks/useFeatureAccess.ts          ← ROUTE_MIN_TIER map
DB types:           src/integrations/supabase/types.ts     ← auto-generated, don't hand-edit
```

### Dashboard (`/`)

```
Page:               src/pages/Index.tsx
Components:         src/components/dashboard/
  CommanderHero.tsx       — dark-blue hero band, 4 KPI cells
  StreakCard.tsx          — call-streak with 7-week grid
  Modules.tsx             — Sphere touches / Pipeline value / Delight sent
  RecentActivityFeed.tsx  — last 5 activities, honest verbs
  UpcomingEvents.tsx
  JumpBackIn.tsx          — role-aware shortcut grid (filtered via useFeatureAccess)
Design reference:   design/dashboard-v2.html
```

### SphereSync (`/spheresync-tasks`)

```
Page:               src/pages/SphereSyncTasks.tsx
Hub component:      src/components/spheresync/
  ContactQuickSheet.tsx                 — the unified contact drawer (~2000 lines)
  ContactSheetProvider.tsx              — global provider for the drawer
  tabs/PrioritiesTab.tsx                — the visible ranked queue
  tabs/CadenceTab.tsx                   — letter rotation view
  tabs/PipelineTab.tsx                  — opportunity rollup
  tabs/HistoryTab.tsx                   — past touches
Core hooks:
  src/hooks/useSphereSyncTasks.ts       — this-week call/text tasks
  src/hooks/usePrioritizedQueue.ts      — the deterministic 3-band queue
  src/hooks/usePrioritizedContacts.ts   — tier-bucketed list for /database
Letter rotation:    src/utils/sphereSyncLogic.ts          ← SPHERESYNC_CALLS, SPHERESYNC_TEXTS
Task generator:     supabase/functions/spheresync-generate-tasks/index.ts
```

### Pipeline (`/pipeline`)

```
Page:               src/pages/Pipeline.tsx
Canvas + board:     src/components/pipeline/PipelineCanvas.tsx
                    src/components/pipeline/PipelineBoard.tsx          ← renders 7 columns
                    src/components/pipeline/PipelineColumn.tsx
Card:               src/components/pipeline/OpportunityCard.tsx
Detail drawer:      src/components/pipeline/OpportunityDetailV2.tsx    ← saveDeal dirty-field tracking
Shared stage UI:    src/components/pipeline/StageLabel.tsx
                    src/components/pipeline/StagePicker.tsx            ← excludes `lost` by default
Stage source:       src/config/pipelineStages.ts                       ← PIPELINE_STAGES, helpers
Hooks:              src/hooks/usePipeline.ts                           — opportunities + metrics
                    src/hooks/useToday.ts                              — overdue/stale/on-track buckets
                    src/hooks/usePipelineFilters.ts                    — board filters
Drag backend:       src/lib/dndBackend.ts                              — HTML5 + touch
```

### Coaching / Scoreboard (`/scoreboard`)

```
Page:               src/pages/Scoreboard.tsx
Check-in modal:     src/components/scoreboard/WeeklyCheckInModalV2.tsx
Hero + cards:       src/components/scoreboard/{ScoreboardHero,MonthlyTrajectoryChart,GrowthGoalsCard,RecentCheckInsPanel}.tsx
Hooks:              src/hooks/useCoaching.ts                — submissions, streak, last4, metrics
                    src/hooks/useCoachingGoals.ts          — annual GCI / closings / conversations goals
                    src/hooks/useGrowthGoals.ts            — qualitative goals
Edge fns:           supabase/functions/coaching-reminder/index.ts        — email reminder
                    supabase/functions/coaching-weekly-nudge/index.ts    — in-app action items
```

### AI Coach

```
Real-time:          supabase/functions/ai-coach-agent/index.ts          — Grok, writes agent_coaching_state
Weekly synthesis:   supabase/functions/generate-agent-intelligence/index.ts — Claude, writes agent_intelligence_snapshots
Reader:             src/hooks/useCoachingState.ts                       — next_hour, today_list, alerts, week_narrative
Reader (weekly):    src/hooks/useAgentIntelligence.ts                   — sphere_health, weekly_priorities
Currently rendered: src/components/commander/CoachContactBlurb.tsx (in opportunity drawer)
                    src/components/spheresync/tabs/PrioritiesTab.tsx (CoachTrustBar only)
COMPUTED BUT NOT RENDERED yet — today_list, week_narrative, alerts[], AgentIntelligenceWidget
```

### Database / Contacts (`/database`)

```
Page:               src/pages/Database.tsx
Hooks:              src/hooks/useContacts.ts                — full list (capped at 5000)
                    src/hooks/useDatabaseStats.ts          — server-side COUNT queries for tile counters
                    src/hooks/usePrioritizedContacts.ts    — tier-bucketed (Hot/Warm/Cool/Cold)
                    src/hooks/useDNCStats.ts               — DNC scrubbing summary
Priority scorer:    supabase/functions/compute-priority-scores/index.ts ← formula lives here
```

### Settings (`/settings`)

```
Page:               src/pages/Settings.tsx                 — 7 sections, sticky-rail nav
Hooks:              src/hooks/useUserProfile.ts            — identity/contact slice of profiles
                    src/hooks/useAgentMarketingSettings.ts — brand/AI/content (single source of truth)
                    src/hooks/useNotificationPrefs.ts      — timezone, quiet hours, reminder day
                    src/hooks/useCoachingGoals.ts
Asset upload:       src/components/settings/AssetUploader.tsx           — headshot, logos → agent-assets bucket
```

### Delight (`/delight`)

```
Page:               src/pages/Delight.tsx
Hook:               src/hooks/useDelight.ts                — useDelightOpportunities, useGiftHistory, useSendGift, etc.
Edge fns:           supabase/functions/delight-suggest-gift/index.ts
                    supabase/functions/delight-daily-nudge/index.ts
```

### Newsletter (`/newsletter`)

```
Page:               src/pages/Newsletter.tsx
Builder page:       src/pages/NewsletterBuilderPage.tsx (route /newsletter-builder/:templateId?)
Schedule UI:        src/components/newsletter/NewsletterScheduleManager.tsx
Cadence banner:     src/components/dashboard/NewsletterCadenceBanner.tsx
Hooks:              src/hooks/useNewsletterCadenceStatus.ts
                    src/hooks/useNewsletterSchedules.ts
                    src/hooks/useNewsletterAnalytics.ts
Edge fns:           supabase/functions/newsletter-send/index.ts
                    supabase/functions/newsletter-template-send/index.ts
                    supabase/functions/newsletter-monthly/index.ts
                    supabase/functions/generate-ai-newsletter/index.ts
```

### Events (`/events`)

```
Page:               src/pages/Events.tsx                                — auth required
Public RSVP:        src/pages/EventPublicPage.tsx                       — route /event/:slug, no auth
RSVP helpers:       src/hooks/useEvents.ts, useRSVP.ts, useRSVPQuestions.ts
Edge fns:           supabase/functions/event-email-scheduler/index.ts
                    supabase/functions/event-reminder-email/index.ts
                    supabase/functions/send-event-invitation/index.ts
                    supabase/functions/rsvp-confirmation-email/index.ts
```

### Support KB (`/support`, `/support/articles/:slug`)

```
Pages:              src/pages/Support.tsx, src/pages/SupportArticle.tsx
Admin CMS:          src/pages/AdminSupportArticles.tsx
Renderer:           src/components/support/ArticleMarkdown.tsx
Hook:               src/hooks/useSupportKb.ts                           — tier-gated via min_tier
Search edge fn:     supabase/functions/support-search/index.ts          — FTS with ts_headline snippets
```

### Transactions (`/transactions`) — ADMIN ONLY

```
Page:               src/pages/Transactions.tsx
Admin dashboard:    src/components/admin/AdminTransactionsDashboard.tsx
Hook:               src/hooks/useTransactions.ts                        — from transaction_coordination table
External sync:      supabase/functions/opentoclose-sync, opentoclose-webhook
```

---

## Conventions and gotchas

### Vocabulary — user-facing strings

- ✅ **opportunity** / **closing** / **sale** / **transaction**
- ❌ **deal** (replaced May 2026 across ~50 user-facing strings, PR #27)
- ✅ **"Deal-breakers"** is OK — real-estate industry term meaning "things a buyer won't accept" (`buyer_deal_breakers` column)
- ✅ Internal types/keys like `deal_value`, `dealsByStage`, `interface Deal` are kept — they're not user-visible
- ✅ Type/opportunity_type stays as Buyer/Seller/Referral (badge on cards, independent of stage)
- ✅ "The Coach" / "AI Coach" — not "Karl" (Karl is the user's *other* company, Shadow Karl AI)

### Pipeline stages (Pam's 7, May 14 2026, PR #28)

Flat universal list — no buyer/seller/referral split for stages. Source of truth: `src/config/pipelineStages.ts`.

```
conversation_active      → first chat
opportunity_identified   → real buyer/seller confirmed
consultation_completed   → buyer consult or listing presentation done
client_secured           → buyer rep / listing agreement signed   ← typically empty at first
active_opportunity       → touring / actively listed
under_contract           → offer accepted
closed                   → done (terminal, won)
lost                     → terminal, off-board (filter-accessible)
NULL                     → sphere-only opportunity (in opportunities table but off the kanban)
```

Helpers:
- `getAllStages()` — all 8 (for stage history)
- `getBoardStages()` — the 7 minus `lost` (for the kanban)
- `getStageByKey(key)`, `getStageLabel(key)`, `getStageShortLabel(key)`, `getStageAccent(key)`, `getNextStage(key)`
- `pipelineTypeFromOpportunityType(t)` — for the type badge (still useful)

### Brand tokens (REOP)

Defined in `src/index.css` `:root` block, mapped in `tailwind.config.ts` under the `reop` namespace:

| Token | Value | Use |
|---|---|---|
| `--reop-teal` / `#0fb1c4` | Primary accent | Buttons, links, focus rings |
| `--reop-teal-hover` | Slightly darker teal | Hover state |
| `--reop-teal-soft` | Very light teal | Soft backgrounds, pills |
| `--reop-dark-blue` / `#005d6c` | Brand dark | Hero band, headings, body text |
| `--reop-dark-blue-2` | Darker still | Inset surfaces |
| `--reop-green` / `#99ca3c` | Accent | Trend up indicators, success |
| `--reop-green-soft` | Very light green | Soft badges |
| `--reop-hero-*` | Variants for the dark hero card | Hero stat bg, eyebrow text, trend chip |
| `--reop-warm-*` | Amber soft + fg | "needs attention" pills |
| `--reop-surface-*` | Subtle grays | Card-on-card surfaces |

**Never write raw `hsl(...)` literals on dashboard/pipeline surfaces. Use tokens.** Exception: `hsl(var(--reop-*) / 0.10)` inside arbitrary Tailwind shadows is fine — that's token-with-opacity, not a magic value.

### Source of truth — brand fields

- **`agent_marketing_settings`** is the single source of truth for brand: `primary_color`, `secondary_color`, `headshot_url`, `logo_colored_url`, `logo_white_url`, `gpt_prompt`, `brand_guidelines`, `target_audience`, `tone_guidelines`, `what_not_to_say`, `example_copy`, `signature_block`, `sender_name`, `scheduling_url`, plus integration IDs (Metricool, ClickUp).
- **`profiles`** has identity + contact + license + brokerage + annual goals + notification prefs. **Brand columns were dropped from profiles in PR #27** (Phase 0 dedup migration `20260504000001_dedupe_profiles_brand_columns`).
- Don't read brand fields from `profiles` ever — they no longer exist.

### Migrations

- File name pattern: `YYYYMMDDHHMMSS_snake_case_name.sql` in `supabase/migrations/`.
- Apply via Supabase MCP: `mcp__...__apply_migration` with `name` + `query`. The MCP wraps in a transaction.
- **For bulk renames that fire triggers** (e.g. stage renames, terminology updates): wrap `UPDATE` in `ALTER TABLE ... DISABLE TRIGGER USER;` / `ENABLE TRIGGER USER;` to suppress spurious history rows / Coach-dirty flags / `updated_at` churn.
- The **Supabase Preview CI check has an 8-month-old ordering bug** with `newsletter_cache` and `get_current_user_role()`. It always shows red X on PRs. Production is fine. Don't waste time fixing the Preview unless explicitly asked.

### Edge function deploys

- Via Supabase MCP: `mcp__...__deploy_edge_function`. Provide ALL files including `../_shared/cors.ts` if used.
- Most functions set `verify_jwt: true`. Set to `false` only for webhook receivers with their own auth.
- Cron-triggered functions check `req.headers.get('X-Cron-Job') === 'true'` or service-role JWT.

### TypeScript config is lenient

`tsconfig.app.json` has `strict: false, noImplicitAny: false`. **`bunx tsc --noEmit` won't catch missing imports.** It will pass even when half the file is broken. Always also run:

```
bunx eslint src/pages/<file>.tsx src/components/<dir>/*.tsx
```

ESLint catches missing imports. The 30+ pre-existing `any` warnings in `OpportunityDetailV2.tsx`, `usePipeline.ts`, `usePipelineFilters.ts` are NOT regressions — leave them unless explicitly fixing.

### Dev workflow

```bash
# Start dev server
bun dev                    # typically :5173, falls back to :5174

# Typecheck
bunx tsc --noEmit

# Lint touched files
bunx eslint src/path/to/file.tsx

# Regenerate Supabase types after a schema change
# (via the MCP — Bash returns oversized output; jq-unwrap from the saved tool-results file)
mcp__supabase__generate_typescript_types → save to src/integrations/supabase/types.ts
```

### Git workflow

- **Never push directly to `main`.** Always a feature branch + PR + squash-merge.
- Branch naming: `feat/<topic>`, `docs/<topic>`, `fix/<topic>`. The `claude/<auto-name>` worktree branches also work.
- I'm running inside a **worktree** at `.claude/worktrees/cool-hugle-a5181b/`. The parent repo has its own checkout — `git checkout main` here fails because the parent has main checked out. To branch off main from the worktree: `git reset --hard origin/main` then `git checkout -b <new-branch>`.
- **`.claude/`** is gitignored (Claude session metadata).
- **`design/`** is gitignored (local-only HTML mockups Pam sends).
- **`.env`** is gitignored.

### Localhost auth wall

The Vite dev server uses a fresh anonymous session. Most authenticated pages (Pipeline, SphereSync, Database) hit an auth wall on localhost. Only Dashboard and Settings render cleanly without manual login. Don't waste time trying to take screenshots of auth-walled pages.

### Python on macOS

- Use `python3` (system 3.9.x). No `--break-system-packages` flag (not supported on 3.9).
- `pip install --user` works. Watch out for compiled deps (pycairo, weasyprint deps) that need brew-installed system libs.
- For markdown → PDF, the working stack is `markdown` + `reportlab` (pure Python). Avoid `weasyprint` and `xhtml2pdf` (require pycairo).

### AI Coach honest caveat

The Coach is running and writing to `agent_coaching_state` every 2h on workdays. Several outputs are **computed but not yet rendered**:

- `today_list` — ranked array, only read by `CoachContactBlurb` in opp drawer.
- `week_narrative` — five-sentence weekly summary, NO consumer yet.
- `alerts[]` — global alerts, NO global consumer (only filtered per-contact view in `CoachContactBlurb`).
- `AgentIntelligenceWidget` — built but not mounted on the dashboard.
- `useCoachTasks` / `useDismissCoachTask` — library code, no UI imports them.

If a user asks "why isn't the Coach showing X?" — it's most likely "computed but not wired." Wire it before assuming it's broken.

---

## Current state (snapshot)

- **Branch:** likely on a feature branch under `feat/` or `docs/`. Main = origin/main.
- **Latest merged PRs:** #27 (Dashboard + Settings + opportunities terminology), #25 (SphereSync 3-tab hub), #24 (AI-first Dashboard).
- **Recent open PRs:**
  - **#28** — Pam's 7 pipeline stages (migration + code, applied to live DB May 14)
  - **#29** — Comprehensive system architecture doc + this CLAUDE.md + DECISIONS.md
- **Last live DB migration applied:** `20260514000001_pam_pipeline_stages`.

See `docs/DECISIONS.md` for the append-only log of what shipped when.

---

## Pointers to deep-dives

- **`docs/SYSTEM_ARCHITECTURE.md`** — 7,000-word partner-readable architecture doc. Cadence, temperature, pipeline, Coach, cron, security. Most accurate description of how things actually work.
- **`docs/DECISIONS.md`** — append-only decision log. One entry per shipped PR.
- **`docs/spheresync-coach-design.md`** — older design doc for the SphereSync coach system. Some details superseded by the May 2026 work.
- **`design/` (gitignored)** — local-only HTML mockups Pam sends. `design/dashboard-v2.html` is the canonical dashboard reference.

---

## What to do when starting a new chat in this repo

1. Read this file (auto-loaded — you already did).
2. Check `docs/DECISIONS.md` for the latest entries to see what was shipped most recently.
3. If the user asks about a specific subsystem, jump to `docs/SYSTEM_ARCHITECTURE.md` § for that subsystem.
4. If the user asks about a specific file, the **file map above** tells you where it lives.
5. If you're about to do something destructive (drop a column, force-push, delete files) — **ask first**, even if the user previously approved a similar action. Each destructive action gets fresh consent.
