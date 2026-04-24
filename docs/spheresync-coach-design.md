# SphereSync Coach — Phase B design

The Coach is the unifying brain of SphereSync. Every downstream surface
(Commander home, Pipeline lens, Sphere lens, contact detail, chat) reads
the state the Coach produces. This document is the contract.

## Goals

- **One coherent picture of an agent's business**, not four fragmented ones.
- **Concrete, actionable output**: the Coach tells the agent *what to do
  next*, *who to talk to*, and *what to say* — not just "here are some metrics."
- **Cost-conscious**: < $2/month total for the current agent base; scales
  linearly.
- **Observable**: every output row has a reasoning trail the agent can trust.

## Non-goals (explicit)

- Not replacing the existing `spheresync-tasks` weekly cadence system in
  this phase — Phase D subsumes it.
- Not a realtime streaming agent. Updates are tick-based (cron + events
  marking state dirty for the next tick).
- Not answering general real-estate questions. The Coach's scope is *this
  agent's book of business*.

## The output — `agent_coaching_state`

One JSONB row per agent, rewritten on each tick. Stable schema so every
UI can read it.

```sql
CREATE TABLE public.agent_coaching_state (
  agent_id         UUID PRIMARY KEY REFERENCES public.profiles(user_id) ON DELETE CASCADE,

  -- Version counter for client cache-busting
  version          INTEGER NOT NULL DEFAULT 1,
  generated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  model            TEXT,          -- which Grok model produced the AI sections

  -- The hero action — "what to do right now"
  next_hour        JSONB,         -- { contact_id, opportunity_id?, action, reasoning, first_sentence, urgency }

  -- Prioritized day plan (5-8 items)
  today_list       JSONB DEFAULT '[]'::jsonb,

  -- Weekly narrative — short sentences, AI-written
  week_narrative   JSONB,         -- { gci_pace, pipeline_story, sphere_story, top_risk, top_win }

  -- Proactive signals — mostly rule-based
  alerts           JSONB DEFAULT '[]'::jsonb,

  -- Compact summary the chat feature uses as grounding context
  chat_context     JSONB,

  -- Observability
  tokens_in        INTEGER,
  tokens_out       INTEGER,
  run_ms           INTEGER,

  -- Dirty flag — when set, next scheduled tick refreshes
  dirty            BOOLEAN NOT NULL DEFAULT false,

  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_coaching_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agents read own coaching state"
  ON public.agent_coaching_state FOR SELECT
  USING (agent_id = auth.uid() OR get_current_user_role() = 'admin');
```

### Shape of each JSON block

```ts
interface NextHour {
  contact_id: string;
  contact_name: string;
  opportunity_id?: string;
  action: 'call' | 'text' | 'email' | 'meet' | 'send_listing' | 'follow_up' | 'write_note';
  urgency: 'overdue' | 'timely' | 'proactive';
  reasoning: string;          // ONE sentence. Real-estate agent voice.
  first_sentence: string;     // Exact words to open with.
  context_chips: string[];    // 2-3 short facts ("Closed $640k in 2024", "New baby Feb")
}

interface TodayItem {
  contact_id: string;
  contact_name: string;
  opportunity_id?: string;
  priority_score: number;     // from contacts.priority_score
  action: NextHour['action'];
  reasoning: string;
  quick_actions: Array<'call' | 'text' | 'log' | 'snooze' | 'defer'>;
}

interface WeekNarrative {
  gci_pace: string;           // "You're $14k ahead of Q2 pace — push 1 more deal into Pending for cushion."
  pipeline_story: string;     // "3 deals in Active >21 days. Ramos and Chen are movable this week."
  sphere_story: string;       // "A-category touches are on rhythm. B-category drifting — 42 overdue."
  top_risk: string | null;    // Single biggest risk right now
  top_win: string | null;     // Single biggest momentum signal
}

interface Alert {
  level: 'info' | 'warning' | 'urgent';
  type: 'overdue_touch' | 'stuck_deal' | 'life_event' | 'market_shift'
      | 'listing_expiring' | 'rsvp_no_show' | 'price_drop_in_zip';
  message: string;            // AI or templated one-liner
  contact_id?: string;
  opportunity_id?: string;
  created_at: string;
}
```

## How the Coach produces state — tick pipeline

One tick = one agent's state refresh. Each tick has 4 phases:

### Phase 1 — Gather (SQL only)

Parallel fetch:
- All this agent's contacts with `priority_*` fields
- Active opportunities with stage, ai_deal_probability, days_in_stage
- Last 30 days of `contact_activities`
- Last 90 days of `opportunity_activities`
- Upcoming `events` + `event_rsvps` for this agent
- `newsletter_market_data` for the top-5 ZIPs in the agent's sphere
- Recent `coaching_submissions` (if any)
- Aggregate pipeline stats: GCI estimated/actual YTD, stage counts,
  average days-in-stage

All materialized into a single `CoachingInputs` object in the function.

### Phase 2 — Compute alerts (rule-based, no AI)

Pure SQL-derived rules:
- `overdue_touch`: A-category contact with `last_activity_date > 14 days ago`
- `stuck_deal`: opportunity `days_in_current_stage > 21`
- `life_event`: contact `life_event` set within last 60 days, no activity yet
- `market_shift`: market pulse for a ZIP changed >10% WoW
- `listing_expiring`: seller opportunity with `listing_expiration <= 14 days`
- `rsvp_no_show`: event in last 7 days, RSVP=yes, no activity logged
- `price_drop_in_zip`: `newsletter_market_data` price reduction >5%

Cap at top 8 alerts by severity to keep the UI tractable.

### Phase 3 — Prioritize (1 Grok call)

Take top-30 candidate contacts (high priority_score + overdue touches +
active opportunities + alerts) and ask Grok to pick 5–8 for *today's
action list* and designate 1 as *next_hour*.

```
SYSTEM PROMPT (cached):
You are a real-estate agent's coach. Given a candidate list with
priority scores, reasoning, last activity, active deal info, life event,
and market context, produce:
- today_list: 5-8 items with action (call/text/email/...), 1-sentence
  reasoning, first_sentence opener, context_chips
- next_hour: the single most time-critical item

Voice: warm, concrete, short. No jargon. Never invent data. If the input
lacks a signal, say so.

USER: <JSON of candidates + constraints + current time>
OUTPUT: JSON matching NextHour + TodayItem[] schema
```

### Phase 4 — Weekly narrative (1 Grok call, less frequent)

Only runs daily (vs tick-frequency for prioritization). Takes aggregated
metrics (GCI pacing, stage distribution, sphere health counters) and
produces 5 short sentences. Cheap because small input, small output.

### Phase 5 — Persist

Upsert into `agent_coaching_state`. Increment `version`. Reset `dirty`.

## Scheduling

| Tick | When | What refreshes |
|---|---|---|
| **nightly-full** | 04:00 UTC | All 5 phases, every agent |
| **workday-quick** | Every 2h, 07:00–19:00 local | Phases 1–3 + 5 (skip narrative), agents with `dirty=true` only |
| **event-dirty** | On activity insert / stage change | Sets `dirty=true`. The next workday-quick tick picks it up. |

This means: an activity logged at 10:03 propagates into the state by
11:00 (bounded latency), not in real time. That matches how an agent
actually works.

## Failure modes + degradation

| Failure | Behavior |
|---|---|
| Grok API down | Fall back to rule-based prioritization (priority_score DESC + staleness). Narrative blocks stay null. `model = 'fallback'`. |
| Grok returns invalid JSON | Log first 200 chars, skip the AI output for this tick, keep rule-based alerts. |
| Agent has zero data | Produce a welcoming empty state ("Import your sphere to get started"), not a broken page. |
| Rate limit on Grok | Stagger nightly-full across 30 minutes (chunk agents by hash bucket). |

## Cost estimate

Per agent, per tick: ~2 Grok calls, ~3k in / ~500 out tokens. At
Grok-4-1-fast-reasoning rates (~$0.20/M in + $0.50/M out):

- Prioritize: ~3k in + ~500 out ≈ $0.0009
- Narrative: ~2k in + ~250 out ≈ $0.0005
- **Per-tick cost: ~$0.0014**

Ticks per agent per day: 1 nightly + up to 6 workday-quick = ~7 ticks.
Narrative runs once/day.

- Per agent per day: ~$0.0105
- Per agent per month: ~$0.31
- 10 agents: ~$3.10/month

Acceptable. Well under the $12/month ceiling the full-rescore would've
cost for 1 agent.

## Consumers (downstream surfaces)

All consumers read the same row. No one bypasses it.

- **Commander (Phase C)**: `SELECT * FROM agent_coaching_state WHERE agent_id = auth.uid()`
- **Pipeline lens (Phase D)**: reads `today_list` + `alerts` filtered to pipeline actions
- **Sphere lens (Phase D)**: reads `today_list` + `alerts` filtered to relationship actions
- **Contact detail (Phase E)**: queries `today_list`/`alerts` scoped to a contact_id
- **Chat (Phase E)**: uses `chat_context` as grounding

## Implementation milestones (commits on the Phase B branch)

1. **B1** — Migration: `agent_coaching_state` + RLS + indexes. (1 file)
2. **B2** — Edge fn skeleton: auth, env, Phase 1 gather, no AI yet. Upserts stub row. (1 file)
3. **B3** — Rule-based alerts (Phase 2). (~100 LOC)
4. **B4** — Prioritize call (Phase 3) + the long prompt. Graceful fallback path. (~150 LOC)
5. **B5** — Weekly narrative call (Phase 4). (~80 LOC)
6. **B6** — Cron jobs (nightly-full, workday-quick) + dirty triggers. (1 migration)
7. **B7** — `useCoachingState` React hook (TanStack Query).
8. **B8** — Smoke test script via pg_net against a single test agent.

Each milestone is independently reviewable. Phase C starts when B8 passes.

## Anti-patterns to call out during review

- **Don't add columns to `agent_coaching_state`** casually. Every column is a
  contract with every downstream surface. Prefer JSONB keys inside existing
  columns.
- **Don't make the Coach query foreign APIs synchronously** inside a tick.
  Market pulse, DNC checks, etc. — those are populated by their own
  functions into DB tables. The Coach only reads DB.
- **Don't let prompts drift**. The system prompt is a contract. Changes
  require regenerating a sample set and reviewing output quality.
- **Don't write a "refresh now" UI button**. Dirty flag + the next
  scheduled tick is the only refresh path. (Lesson from Phase 2.)

## Open questions (resolve before B4)

1. **Voice style reference** — do you have an example of how you'd
   phrase a reasoning line to an agent? (One paragraph from a past email
   or coaching note would be gold for prompt tuning.)
2. **First-sentence opener calibration** — should the Coach's
   `first_sentence` be deferential ("Hi Maria, this is Leo — hope I'm
   not catching you at a bad time") or punchy ("Maria — your place at
   20012 just comped at $1.1M. Wanted you to see it first")? Probably
   agent-configurable, but we need a default.
3. **Does the Coach own any write paths?** (e.g. can it auto-add a
   SphereSync task for an overdue touch?) My default: no — the Coach
   recommends, the agent acts. Write paths stay explicit.
