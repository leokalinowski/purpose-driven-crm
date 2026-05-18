/**
 * compute-priority-scores
 *
 * Deterministic 0–100 priority score for every active contact, plus a
 * `priority_band` classifier so UI surfaces can group consistently without
 * re-deriving from the score.
 *
 * Formula (when an active opportunity exists):
 *   0.40 · pipeline + 0.35 · cadence + 0.10 · engagement
 * + 0.10 · relationship + 0.05 · flags
 *
 * When no active opportunity, the 0.40 pipeline weight is redistributed across
 * the other components proportionally (cadence still dominates, relationship
 * gets a bump, engagement and flags hold their relative ratio).
 *
 * Components (each 0–100):
 *   • pipeline    — Pam's 7 stages. EARLY stages are weighted HIGHER than
 *                   late stages, because the agent forgets the
 *                   conversation_active contact, not the one already under
 *                   contract (transaction coordination keeps the late stages
 *                   warm). Stale-in-stage penalty applies on top.
 *   • cadence     — driven by `contacts.category` (the SphereSync rotation
 *                   letter). High when the contact's letter is current and
 *                   no completed `spheresync_tasks` row exists for this week.
 *                   Also flags overdue letters from last week.
 *   • engagement  — gifts (`contact_activities.activity_type='gift'`),
 *                   email-matched event RSVPs, recent logged activity.
 *   • relationship — freshness curve on `last_activity_date`.
 *   • flags       — VIP / pre-approval / explicit watch / motivation ≥ 7.
 *
 * No LLM calls. The score is fully reproducible from DB state.
 *
 * Invocation
 *   POST /functions/v1/compute-priority-scores
 *     {}                          ← cron (all agents, all contacts)
 *     { agent_id }                ← one agent's full sphere
 *     { contact_ids: [uuid,...] } ← event-driven recompute
 *
 * Auth
 *   • cron:  X-Cron-Job: true  OR  source: pg_cron   (no user auth required)
 *   • user:  bearer token; admin can target any agent, agent can target own
 *            contacts only.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

// Inlined to keep the function self-contained for the Supabase MCP
// `deploy_edge_function` bundler, which has trouble resolving `../_shared/*`
// across the source/ boundary. The canonical version lives at
// `supabase/functions/_shared/cors.ts` — keep them in sync if you change one.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// ─── Types ────────────────────────────────────────────────────────────────────

type UUID = string;
type PriorityBand = 'pipeline' | 'cadence' | 'engagement' | 'sphere';

interface ContactRow {
  id: UUID;
  agent_id: UUID;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  category: string | null;        // SphereSync rotation letter (last-name initial)
  tags: string[] | null;
  last_activity_date: string | null;
  life_event: string | null;
  buyer_pre_approval_status: string | null;
  motivation_score: number | null;
  priority_watch_flag: boolean;
}

interface OpportunityRow {
  id: UUID;
  contact_id: UUID;
  stage: string;
  outcome: string | null;
  days_in_current_stage: number | null;
}

interface ActivitySummary {
  last_90d: number;
  last_30d: number;
  last_14d: number;
  gift_last_30d: number;
  most_recent_at: string | null;
  most_recent_type: string | null;
}

// ─── SphereSync rotation (inlined from src/utils/sphereSyncLogic.ts) ─────────
// Keep in sync. 2 letters per week for calls + 1 letter per week for texts.

const SPHERESYNC_CALLS: Record<number, string[]> = {
  1:  ['S','Q'], 2:  ['M','X'], 3:  ['B','Y'], 4:  ['C','Z'], 5:  ['H','U'],
  6:  ['W','E'], 7:  ['L','I'], 8:  ['R','O'], 9:  ['T','V'], 10: ['P','J'],
  11: ['A','K'], 12: ['D','N'], 13: ['F','G'],
  14: ['S','X'], 15: ['M','Y'], 16: ['B','Z'], 17: ['C','U'], 18: ['H','E'],
  19: ['W','I'], 20: ['L','O'], 21: ['R','V'], 22: ['T','J'], 23: ['P','K'],
  24: ['A','N'], 25: ['D','G'], 26: ['F','Q'],
  27: ['S','Y'], 28: ['M','Z'], 29: ['B','U'], 30: ['C','E'], 31: ['H','I'],
  32: ['W','O'], 33: ['L','V'], 34: ['R','J'], 35: ['T','K'], 36: ['P','N'],
  37: ['A','G'], 38: ['D','Q'], 39: ['F','X'],
  40: ['S','Z'], 41: ['M','U'], 42: ['B','E'], 43: ['C','I'], 44: ['H','O'],
  45: ['W','V'], 46: ['L','J'], 47: ['R','K'], 48: ['T','N'], 49: ['P','G'],
  50: ['A','Q'], 51: ['D','X'], 52: ['F','Y'],
};

const SPHERESYNC_TEXTS: Record<number, string> = {
  1: 'M', 2: 'B', 3: 'C', 4: 'H', 5: 'W', 6: 'L', 7: 'R', 8: 'T', 9: 'P',
  10: 'A', 11: 'D', 12: 'F', 13: 'G',
  14: 'S', 15: 'K', 16: 'N', 17: 'V', 18: 'J', 19: 'E', 20: 'I', 21: 'O',
  22: 'U', 23: 'M', 24: 'B', 25: 'C', 26: 'H',
  27: 'W', 28: 'L', 29: 'R', 30: 'T', 31: 'P', 32: 'A', 33: 'D', 34: 'F',
  35: 'G', 36: 'S', 37: 'K', 38: 'N', 39: 'V',
  40: 'J', 41: 'E', 42: 'I', 43: 'O', 44: 'U', 45: 'Q', 46: 'X', 47: 'Y',
  48: 'Z', 49: 'M', 50: 'B', 51: 'C', 52: 'H',
};

function isoWeek(date: Date): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { week: Math.min(week, 52), year: d.getUTCFullYear() };
}

function previousWeek(week: number, year: number): { week: number; year: number } {
  if (week <= 1) return { week: 52, year: year - 1 };
  return { week: week - 1, year };
}

function rotationFor(week: number): { calls: string[]; text: string; all: Set<string> } {
  const calls = SPHERESYNC_CALLS[week] ?? [];
  const text = SPHERESYNC_TEXTS[week] ?? '';
  const all = new Set([...calls, text].filter(Boolean).map((c) => c.toUpperCase()));
  return { calls, text, all };
}

// ─── Component scorers (deterministic, no AI) ────────────────────────────────

/**
 * 0–100, or null if no active opportunity (weight redistributes).
 *
 * Pam's 7 stages, EARLY-stage-heavy. Rationale: agents don't forget the deal
 * that's already under contract (transaction coordination keeps them warm).
 * They forget the conversation-active contact who never got pinned down.
 * So the score is inversely proportional to how committed the contact is.
 */
function pipelineScore(opp: OpportunityRow | null): number | null {
  if (!opp) return null;
  if (opp.outcome === 'lost' || opp.outcome === 'withdrawn') return null;

  const stageBaseline: Record<string, number> = {
    conversation_active:    90,
    opportunity_identified: 85,
    consultation_completed: 80,
    client_secured:         50,
    active_opportunity:     40,
    under_contract:         25,
    // closed / lost are filtered out by `actual_close_date IS NULL` and the
    // outcome check above; no entry needed.
  };

  let score = stageBaseline[opp.stage] ?? 50;

  // Stale-in-stage penalty — even an early-stage opp that's sat for a month
  // drops because the agent is clearly stuck or has moved on.
  const days = opp.days_in_current_stage ?? 0;
  if (days > 30)      score = Math.max(0, score - 25);
  else if (days > 14) score = Math.max(0, score - 15);

  return Math.min(100, Math.max(0, score));
}

/**
 * 0–100. Driven by the SphereSync letter rotation.
 *
 *   90 — contact's letter is in THIS week's rotation AND no completed
 *        spheresync_tasks row exists this week (the agent owes them a touch)
 *   75 — contact's letter was in LAST week's rotation AND no completion
 *        (overdue — agent missed the rotation slot)
 *   30 — this week's letter, task ALREADY completed (no urgency)
 *   15 — out of rotation, sphere-level
 */
function cadenceScore(
  category: string | null,
  currentLetters: Set<string>,
  prevLetters: Set<string>,
  hasCompletedTaskThisWeek: boolean,
  hasCompletedTaskLastWeek: boolean,
): number {
  if (!category) return 15;
  const letter = category.toUpperCase();

  if (currentLetters.has(letter)) {
    return hasCompletedTaskThisWeek ? 30 : 90;
  }
  if (prevLetters.has(letter)) {
    return hasCompletedTaskLastWeek ? 25 : 75;
  }
  return 15;
}

/**
 * 0–100. Marketing-engagement signal — intentionally LOW weight in the blend.
 * What we can capture today:
 *   +30  one or more gift activities in last 30d
 *   +20  an event RSVP whose email matches this contact (last 90d)
 *   +15  any logged call/text/email in last 14d
 *   +10  any logged activity in last 30d
 * (Newsletter opens/clicks will plug in here when the Resend webhook lands —
 *  Phase 4 of the prioritization roadmap.)
 */
function engagementScore(
  activity: ActivitySummary,
  hasRecentRsvp: boolean,
): number {
  let score = 0;
  if (activity.gift_last_30d > 0) score += 30;
  if (hasRecentRsvp)              score += 20;
  if (activity.last_14d > 0)      score += 15;
  if (activity.last_30d > 0)      score += 10;
  return Math.min(100, score);
}

/** 0–100. Freshness curve on last_activity_date. Tie-breaker / base layer. */
function relationshipScore(
  daysSinceLast: number | null,
  count30d: number,
  count90d: number,
): number {
  if (daysSinceLast === null) return 30; // never touched — neutral-low
  let base: number;
  if      (daysSinceLast <= 30)  base = 92;
  else if (daysSinceLast <= 60)  base = 78;
  else if (daysSinceLast <= 90)  base = 58;
  else if (daysSinceLast <= 180) base = 38;
  else                            base = 15;
  if      (count30d >= 3) base = Math.min(100, base + 8);
  else if (count90d >= 5) base = Math.min(100, base + 4);
  return base;
}

/** 0–100. Agent-managed flags. */
function flagsScore(c: ContactRow): number {
  let score = 30;
  if (c.priority_watch_flag)                                       score += 25;
  if (c.buyer_pre_approval_status === 'approved')                  score += 25;
  if ((c.tags ?? []).some((t) => t.toUpperCase() === 'VIP'))       score += 20;
  if (c.motivation_score != null && c.motivation_score >= 7)       score += 10;
  return Math.min(100, score);
}

// ─── Blend + band classification ─────────────────────────────────────────────

interface ComponentScores {
  pipeline: number | null;
  cadence: number;
  engagement: number;
  relationship: number;
  flags: number;
}

const BASE_WEIGHTS = {
  pipeline:     0.40,
  cadence:      0.35,
  engagement:   0.10,
  relationship: 0.10,
  flags:        0.05,
};

function blend(c: ComponentScores): {
  score: number;
  weighted: Record<string, number>;
  band: PriorityBand;
} {
  // When no active opportunity, redistribute the 0.40 pipeline weight across
  // the other components proportionally (so the other ratios are preserved).
  let weights: typeof BASE_WEIGHTS;
  if (c.pipeline === null) {
    const remaining = 1 - BASE_WEIGHTS.pipeline; // = 0.60
    weights = {
      pipeline:     0,
      cadence:      +(BASE_WEIGHTS.cadence      / remaining).toFixed(4),
      engagement:   +(BASE_WEIGHTS.engagement   / remaining).toFixed(4),
      relationship: +(BASE_WEIGHTS.relationship / remaining).toFixed(4),
      flags:        +(BASE_WEIGHTS.flags        / remaining).toFixed(4),
    };
  } else {
    weights = { ...BASE_WEIGHTS };
  }

  const weighted = {
    pipeline:     Math.round((c.pipeline ?? 0) * weights.pipeline),
    cadence:      Math.round(c.cadence         * weights.cadence),
    engagement:   Math.round(c.engagement      * weights.engagement),
    relationship: Math.round(c.relationship    * weights.relationship),
    flags:        Math.round(c.flags           * weights.flags),
  };

  const score = Math.min(100, Math.max(0,
    weighted.pipeline + weighted.cadence + weighted.engagement +
    weighted.relationship + weighted.flags,
  ));

  // Band = the dominant primary contributor. "Sphere" only when nothing
  // primary is firing (i.e., score is being carried by relationship+flags).
  const primary: Array<[PriorityBand, number]> = [
    ['pipeline',   weighted.pipeline],
    ['cadence',    weighted.cadence],
    ['engagement', weighted.engagement],
  ];
  primary.sort((a, b) => b[1] - a[1]);
  const band: PriorityBand = primary[0][1] > 0 ? primary[0][0] : 'sphere';

  return { score, weighted, band };
}

// ─── Deterministic reasoning (one short sentence) ────────────────────────────

function buildReasoning(args: {
  band: PriorityBand;
  contact: ContactRow;
  opp: OpportunityRow | null;
  daysSinceLast: number | null;
  currentWeek: number;
  letterIsCurrent: boolean;
  letterIsPrev: boolean;
  taskDoneThisWeek: boolean;
  gift30d: boolean;
  recentRsvp: boolean;
}): string {
  const { band, contact, opp, daysSinceLast, currentWeek,
          letterIsCurrent, letterIsPrev, taskDoneThisWeek,
          gift30d, recentRsvp } = args;
  const letter = (contact.category ?? '').toUpperCase();

  if (band === 'pipeline' && opp) {
    const stageLabel = humanStage(opp.stage);
    const days = opp.days_in_current_stage ?? 0;
    if (days > 30) {
      return `${stageLabel} — stalled ${days} days. Don't lose this one.`;
    }
    if (days > 14) {
      return `${stageLabel} — quiet for ${days} days. Worth a nudge.`;
    }
    return `${stageLabel} — keep it moving.`;
  }

  if (band === 'cadence') {
    if (letterIsCurrent && !taskDoneThisWeek) {
      return `Week ${currentWeek} rotation (letter ${letter}) — owed a touch this week.`;
    }
    if (letterIsPrev) {
      return `Overdue from last week's rotation (letter ${letter}).`;
    }
    if (letterIsCurrent && taskDoneThisWeek) {
      return `This week's rotation (letter ${letter}) — already touched.`;
    }
    // Shouldn't happen if band='cadence', but be defensive.
    return `On SphereSync rotation (letter ${letter}).`;
  }

  if (band === 'engagement') {
    if (gift30d && recentRsvp) {
      return `Recently engaged — gift sent + RSVP'd to an event.`;
    }
    if (gift30d)    return `Recently received a gift — perfect window for a follow-up.`;
    if (recentRsvp) return `RSVP'd to one of your events — follow up while it's fresh.`;
    return `Engaged recently — strike while warm.`;
  }

  // Sphere fallback
  if (daysSinceLast === null) return `Never touched. Reach out and open the door.`;
  if (daysSinceLast > 365)    return `Dormant ${Math.round(daysSinceLast / 30)} months — reactivation candidate.`;
  if (daysSinceLast > 180)    return `Last touch ${Math.round(daysSinceLast / 30)} months ago — overdue.`;
  return `Steady-state sphere contact.`;
}

function humanStage(stage: string): string {
  const labels: Record<string, string> = {
    conversation_active:    'Conversation active',
    opportunity_identified: 'Opportunity identified',
    consultation_completed: 'Consultation completed',
    client_secured:         'Client secured',
    active_opportunity:     'Active opportunity',
    under_contract:         'Under contract',
    closed:                 'Closed',
    lost:                   'Lost',
  };
  return labels[stage] ?? stage.replace(/_/g, ' ');
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  // ── Env ─────────────────────────────────────────────────────────────────────
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseServiceKey) return json({ error: 'Missing Supabase env' }, 500);

  // ── Auth ───────────────────────────────────────────────────────────────────
  const isCron =
    req.headers.get('X-Cron-Job') === 'true' ||
    req.headers.get('source') === 'pg_cron';

  let callerAgentId: UUID | null = null;
  let callerIsAdmin = false;

  if (!isCron) {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Auth required' }, 401);

    const userClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    if (!userRes?.user) return json({ error: 'Invalid token' }, 401);
    callerAgentId = userRes.user.id;

    const { data: role } = await userClient.rpc('get_current_user_role');
    callerIsAdmin = role === 'admin';
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const body = await req.json().catch(() => ({}));
  const targetAgentId: UUID | null = body.agent_id ?? null;
  const targetContactIds: UUID[] | null = Array.isArray(body.contact_ids) ? body.contact_ids : null;

  if (!isCron && !callerIsAdmin) {
    if (targetAgentId && targetAgentId !== callerAgentId) {
      return json({ error: 'Agents can only score their own contacts' }, 403);
    }
  }

  // ── Resolve target contacts ────────────────────────────────────────────────
  // NOTE on batch size: this function does NOT chunk `.in()` filters itself —
  // PostgREST URLs blow past ~8 KB at ~200 UUIDs in an .in() list. The cron
  // RPC `invoke_priority_rescore` handles batching upstream (100 IDs per
  // pg_net.http_post invocation). Frontend callers that trigger a per-contact
  // or per-agent rescore are well within that limit; admin tools that want
  // to rescore very large lists should call the RPC, not this function
  // directly.
  let contactsQuery = supabase
    .from('contacts')
    .select(`
      id, agent_id, first_name, last_name, email, category, tags,
      last_activity_date, life_event,
      buyer_pre_approval_status, motivation_score, priority_watch_flag
    `);

  if (targetContactIds && targetContactIds.length > 0) {
    contactsQuery = contactsQuery.in('id', targetContactIds);
  } else if (targetAgentId) {
    contactsQuery = contactsQuery.eq('agent_id', targetAgentId);
  } else if (!isCron && !callerIsAdmin) {
    contactsQuery = contactsQuery.eq('agent_id', callerAgentId!);
  }

  const { data: contacts, error: contactsErr } = await contactsQuery;
  if (contactsErr) return json({ error: contactsErr.message }, 500);
  if (!contacts || contacts.length === 0) return json({ scored: 0 });

  const contactIds = contacts.map((c) => c.id);
  const agentIds = Array.from(new Set(contacts.map((c) => c.agent_id)));

  // ── Compute the rotation context once ──────────────────────────────────────
  const now = new Date();
  const { week: curWeek, year: curYear } = isoWeek(now);
  const { week: prevWeekN, year: prevYear } = previousWeek(curWeek, curYear);
  const curRotation = rotationFor(curWeek);
  const prevRotation = rotationFor(prevWeekN);

  // ── Gather inputs in parallel ──────────────────────────────────────────────
  // NOTE on contact_activities: rows split into two populations —
  //   • REAL interactions (outcome IS NOT NULL)
  //   • SphereSync task STUBS (outcome IS NULL + notes starts 'SphereSync ')
  // Only the real ones count as engagement / freshness signal.
  const [activitiesRes, opportunitiesRes, tasksRes, rsvpsRes] = await Promise.all([
    supabase
      .from('contact_activities')
      .select('contact_id, activity_type, activity_date, outcome, notes')
      .in('contact_id', contactIds)
      .gte('activity_date', new Date(Date.now() - 90 * 86400_000).toISOString()),
    supabase
      .from('opportunities')
      .select('id, contact_id, stage, outcome, days_in_current_stage, actual_close_date')
      .in('contact_id', contactIds)
      .is('actual_close_date', null),
    supabase
      .from('spheresync_tasks')
      .select('lead_id, week_number, year, completed')
      .in('lead_id', contactIds)
      .in('week_number', [curWeek, prevWeekN])
      .in('year', [curYear, prevYear]),
    // Event RSVPs join to contacts by EMAIL (no contact_id FK on event_rsvps).
    // Scope to events owned by target agents.
    supabase
      .from('event_rsvps')
      .select('email, created_at, events!inner(agent_id)')
      .in('events.agent_id', agentIds)
      .gte('created_at', new Date(Date.now() - 90 * 86400_000).toISOString()),
  ]);

  if (activitiesRes.error)    return json({ error: 'activities: ' + activitiesRes.error.message }, 500);
  if (opportunitiesRes.error) return json({ error: 'opportunities: ' + opportunitiesRes.error.message }, 500);
  if (tasksRes.error)         return json({ error: 'tasks: ' + tasksRes.error.message }, 500);
  if (rsvpsRes.error) {
    // Non-fatal — engagement just loses the RSVP signal for this run.
    console.warn('rsvps fetch failed (non-fatal):', rsvpsRes.error.message);
  }

  const activitiesRows = activitiesRes.data ?? [];
  const opportunitiesRows = (opportunitiesRes.data ?? []) as OpportunityRow[];
  const tasksRows = tasksRes.data ?? [];
  const rsvpRows = (rsvpsRes.data ?? []) as Array<{ email: string }>;

  // ── Index activity by contact (REAL rows only) ─────────────────────────────
  const activityByContact = new Map<UUID, ActivitySummary>();
  for (const id of contactIds) {
    activityByContact.set(id, {
      last_90d: 0, last_30d: 0, last_14d: 0, gift_last_30d: 0,
      most_recent_at: null, most_recent_type: null,
    });
  }
  const nowMs = Date.now();
  for (const a of activitiesRows) {
    const isStub = a.outcome === null && (a.notes?.startsWith('SphereSync ') ?? false);
    if (isStub) continue;
    const s = activityByContact.get(a.contact_id);
    if (!s) continue;
    s.last_90d += 1;
    const ts = new Date(a.activity_date).getTime();
    const ageMs = nowMs - ts;
    if (ageMs <= 30 * 86400_000) s.last_30d += 1;
    if (ageMs <= 14 * 86400_000) s.last_14d += 1;
    if (a.activity_type === 'gift' && ageMs <= 30 * 86400_000) s.gift_last_30d += 1;
    if (!s.most_recent_at || ts > new Date(s.most_recent_at).getTime()) {
      s.most_recent_at = a.activity_date;
      s.most_recent_type = a.activity_type;
    }
  }

  // ── Pick the most-progressed active opportunity per contact ────────────────
  // Pam's 7-stage ordering: higher index = further along.
  const stageRank: Record<string, number> = {
    conversation_active: 1, opportunity_identified: 2, consultation_completed: 3,
    client_secured: 4, active_opportunity: 5, under_contract: 6,
  };
  const oppByContact = new Map<UUID, OpportunityRow>();
  for (const o of opportunitiesRows) {
    const existing = oppByContact.get(o.contact_id);
    if (!existing || (stageRank[o.stage] ?? 0) > (stageRank[existing.stage] ?? 0)) {
      oppByContact.set(o.contact_id, o);
    }
  }

  // ── Index SphereSync task completion this week / last week ─────────────────
  const taskDoneThisWeek = new Set<UUID>();
  const taskDoneLastWeek = new Set<UUID>();
  for (const t of tasksRows) {
    if (!t.completed) continue;
    if (t.week_number === curWeek  && t.year === curYear)  taskDoneThisWeek.add(t.lead_id);
    if (t.week_number === prevWeekN && t.year === prevYear) taskDoneLastWeek.add(t.lead_id);
  }

  // ── Index RSVP emails (lowercased) ─────────────────────────────────────────
  const rsvpEmails = new Set<string>();
  for (const r of rsvpRows) {
    if (r.email) rsvpEmails.add(r.email.toLowerCase());
  }

  // ── Score each contact ─────────────────────────────────────────────────────
  const upsertRows = contacts.map((cRaw) => {
    const c = cRaw as ContactRow;
    const activity = activityByContact.get(c.id)!;
    const daysSinceLast = c.last_activity_date
      ? Math.floor((nowMs - new Date(c.last_activity_date).getTime()) / 86400_000)
      : null;
    const opp = oppByContact.get(c.id) ?? null;
    const letter = (c.category ?? '').toUpperCase();
    const letterIsCurrent = !!letter && curRotation.all.has(letter);
    const letterIsPrev    = !!letter && prevRotation.all.has(letter);
    const doneThisWeek    = taskDoneThisWeek.has(c.id);
    const doneLastWeek    = taskDoneLastWeek.has(c.id);
    const recentRsvp      = !!c.email && rsvpEmails.has(c.email.toLowerCase());

    const components: ComponentScores = {
      pipeline:     pipelineScore(opp),
      cadence:      cadenceScore(c.category, curRotation.all, prevRotation.all, doneThisWeek, doneLastWeek),
      engagement:   engagementScore(activity, recentRsvp),
      relationship: relationshipScore(daysSinceLast, activity.last_30d, activity.last_90d),
      flags:        flagsScore(c),
    };

    const { score, weighted, band } = blend(components);

    const reasoning = buildReasoning({
      band, contact: c, opp, daysSinceLast,
      currentWeek: curWeek,
      letterIsCurrent, letterIsPrev,
      taskDoneThisWeek: doneThisWeek,
      gift30d: activity.gift_last_30d > 0,
      recentRsvp,
    });

    return {
      id: c.id,
      priority_score: score,
      priority_band: band,
      priority_reasoning: reasoning,
      priority_components: weighted,
      priority_signals: {
        days_since_last_activity: daysSinceLast,
        activity_30d: activity.last_30d,
        activity_90d: activity.last_90d,
        activity_14d: activity.last_14d,
        gift_30d: activity.gift_last_30d,
        recent_rsvp: recentRsvp,
        active_opportunity_stage: opp?.stage ?? null,
        days_in_stage: opp?.days_in_current_stage ?? null,
        rotation_week: curWeek,
        rotation_letter: letter || null,
        letter_is_current: letterIsCurrent,
        letter_is_prev: letterIsPrev,
        task_done_this_week: doneThisWeek,
        life_event: c.life_event,
      },
      priority_computed_at: new Date().toISOString(),
      priority_model: 'deterministic-v2',
    };
  });

  // ── Persist in parallel batches ────────────────────────────────────────────
  // PostgREST upsert tries an INSERT first, which trips NOT NULL on columns
  // we don't provide (e.g. agent_id). Every row already exists → pure UPDATE.
  const UPDATE_CONCURRENCY = 10;
  let written = 0;
  for (let i = 0; i < upsertRows.length; i += UPDATE_CONCURRENCY) {
    const slice = upsertRows.slice(i, i + UPDATE_CONCURRENCY);
    const results = await Promise.all(slice.map(async (row) => {
      const { id, ...update } = row;
      const { error } = await supabase.from('contacts').update(update).eq('id', id);
      return error;
    }));
    const firstErr = results.find(Boolean);
    if (firstErr) {
      console.error('Update failed', firstErr.message);
      return json({ error: firstErr.message, scored_before_error: written }, 500);
    }
    written += slice.length;
  }

  return json({
    scored: upsertRows.length,
    rotation_week: curWeek,
    rotation_letters: Array.from(curRotation.all),
    model: 'deterministic-v2',
  });
});
