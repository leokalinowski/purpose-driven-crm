/**
 * ai-coach-agent — SphereSync Coach (Phase B2 skeleton)
 *
 * The brain of SphereSync. Reads everything that matters about an agent's
 * book of business and produces ONE coaching state row consumed by every
 * downstream surface (Commander, lenses, contact detail, chat).
 *
 * This file is the skeleton (B2): all 5 phases of the tick exist as named
 * functions, but only Phase 1 (gather) and Phase 5 (persist) do real work.
 * Phases 2–4 are stubs returning empty / null. Each subsequent milestone
 * fills in one phase:
 *   - B3 → fillAlerts() — rule-based proactive signals
 *   - B4 → prioritize() — Grok call, today_list + next_hour
 *   - B5 → writeNarrative() — Grok call, week_narrative
 *   - B5.7 → writeCoachTasks() — auto-create tasks
 *
 * Invocation
 *   POST /functions/v1/ai-coach-agent
 *     {}                 ← cron path: refresh all dirty agents
 *     { agent_id }       ← target a specific agent (admin or self)
 *     { force: true }    ← refresh even if not dirty (admin only)
 *
 * Auth
 *   - Cron:  X-Cron-Job: true OR source: pg_cron
 *   - User:  bearer token; admin can target any agent, agent can target self only
 *
 * Reference: docs/spheresync-coach-design.md
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';
import { corsHeaders } from '../_shared/cors.ts';

// ─── Types ────────────────────────────────────────────────────────────────────

type UUID = string;

interface CoachingInputs {
  agent_id: UUID;
  agent_name: string;
  contacts: ContactRow[];
  active_opportunities: OpportunityRow[];
  recent_activities: ActivityRow[];
  market_pulse: Record<string, MarketPulse>;   // keyed by zip_code
  aggregates: Aggregates;
}

interface ContactRow {
  id: UUID;
  first_name: string | null;
  last_name: string | null;
  category: string | null;
  zip_code: string | null;
  tags: string[] | null;
  last_activity_date: string | null;
  life_event: string | null;
  dnc: boolean;
  priority_score: number | null;
  priority_reasoning: string | null;
  priority_components: Record<string, number> | null;
  priority_signals: Record<string, unknown> | null;
  priority_watch_flag: boolean;
}

interface OpportunityRow {
  id: UUID;
  contact_id: UUID;
  stage: string;
  outcome: string | null;
  pipeline_type: string | null;
  opportunity_type: string | null;
  deal_value: number | null;
  expected_close_date: string | null;
  ai_deal_probability: number | null;
  days_in_current_stage: number | null;
  next_step_title: string | null;
  next_step_due_date: string | null;
  is_stale: boolean;
}

interface ActivityRow {
  contact_id: UUID;
  activity_type: string;
  activity_date: string;
  outcome: string | null;
}

interface MarketPulse {
  zip_code: string;
  median_sale_price: number | null;
  inventory: number | null;
  median_dom: number | null;
}

interface Aggregates {
  contact_count: number;
  active_opportunity_count: number;
  pipeline_value: number;
  gci_estimated_open: number;
  contacts_overdue_30d: number;
  contacts_overdue_90d: number;
  stuck_deals_count: number;       // active opps with days_in_current_stage > 21
  unscored_contacts: number;
}

// ─── Phase 1 — Gather (SQL only, no AI) ──────────────────────────────────────

async function gather(supabase: ReturnType<typeof createClient>, agentId: UUID): Promise<CoachingInputs> {
  const since30d = new Date(Date.now() - 30 * 86400_000).toISOString();

  const [profileRes, contactsRes, opportunitiesRes, activitiesRes] = await Promise.all([
    supabase.from('profiles')
      .select('first_name, last_name')
      .eq('user_id', agentId)
      .single(),

    supabase.from('contacts')
      .select(`
        id, first_name, last_name, category, zip_code, tags,
        last_activity_date, life_event, dnc,
        priority_score, priority_reasoning, priority_components, priority_signals,
        priority_watch_flag
      `)
      .eq('agent_id', agentId),

    supabase.from('opportunities')
      .select(`
        id, contact_id, stage, outcome, pipeline_type, opportunity_type,
        deal_value, expected_close_date, ai_deal_probability,
        days_in_current_stage, next_step_title, next_step_due_date, is_stale
      `)
      .eq('agent_id', agentId)
      .is('actual_close_date', null)
      .or('outcome.is.null,outcome.not.in.(lost,withdrawn)'),

    supabase.from('contact_activities')
      .select('contact_id, activity_type, activity_date, outcome')
      .eq('agent_id', agentId)
      .gte('activity_date', since30d)
      .order('activity_date', { ascending: false }),
  ]);

  if (profileRes.error) throw new Error(`gather profile: ${profileRes.error.message}`);
  if (contactsRes.error) throw new Error(`gather contacts: ${contactsRes.error.message}`);
  if (opportunitiesRes.error) throw new Error(`gather opportunities: ${opportunitiesRes.error.message}`);
  if (activitiesRes.error) throw new Error(`gather activities: ${activitiesRes.error.message}`);

  const contacts = (contactsRes.data ?? []) as ContactRow[];
  const opportunities = (opportunitiesRes.data ?? []) as OpportunityRow[];
  const activities = (activitiesRes.data ?? []) as ActivityRow[];

  // Top ZIPs in this agent's sphere — fetch market data only for those
  const zipCounts = new Map<string, number>();
  for (const c of contacts) {
    if (c.zip_code) zipCounts.set(c.zip_code, (zipCounts.get(c.zip_code) ?? 0) + 1);
  }
  const topZips = Array.from(zipCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([z]) => z);

  let marketPulse: Record<string, MarketPulse> = {};
  if (topZips.length > 0) {
    const { data: marketRows } = await supabase
      .from('newsletter_market_data')
      .select('zip_code, median_sale_price, inventory, median_dom')
      .in('zip_code', topZips);
    for (const m of (marketRows ?? [])) {
      marketPulse[m.zip_code] = m as MarketPulse;
    }
  }

  // Aggregates — pure JS over what we already fetched
  const now = Date.now();
  const aggregates: Aggregates = {
    contact_count: contacts.length,
    active_opportunity_count: opportunities.length,
    pipeline_value: opportunities.reduce((s, o) => s + (o.deal_value ?? 0), 0),
    gci_estimated_open: opportunities.reduce((s, o) => s + (o.deal_value ?? 0) * 0.025, 0), // rough — replace with gci_estimated when always set
    contacts_overdue_30d: contacts.filter(c => {
      if (!c.last_activity_date) return false;
      return now - new Date(c.last_activity_date).getTime() > 30 * 86400_000;
    }).length,
    contacts_overdue_90d: contacts.filter(c => {
      if (!c.last_activity_date) return false;
      return now - new Date(c.last_activity_date).getTime() > 90 * 86400_000;
    }).length,
    stuck_deals_count: opportunities.filter(o => (o.days_in_current_stage ?? 0) > 21).length,
    unscored_contacts: contacts.filter(c => c.priority_score === null).length,
  };

  const profile = profileRes.data ?? { first_name: '', last_name: '' };
  return {
    agent_id: agentId,
    agent_name: `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || 'Agent',
    contacts,
    active_opportunities: opportunities,
    recent_activities: activities,
    market_pulse: marketPulse,
    aggregates,
  };
}

// ─── Phase 2 — Alerts (B3) — rule-based proactive signals ────────────────────

interface Alert {
  level: 'info' | 'warning' | 'urgent';
  type: 'overdue_touch' | 'stuck_deal' | 'life_event' | 'high_priority_ignored' | 'opportunity_no_next_step';
  message: string;
  contact_id?: string;
  opportunity_id?: string;
  count?: number;
  created_at: string;
}

function shortName(c: ContactRow): string {
  const f = (c.first_name ?? '').trim();
  const l = (c.last_name ?? '').trim();
  return `${f} ${l}`.trim() || 'Unknown';
}

const CATEGORY_CADENCE: Record<string, number> = {
  'A-Plus': 14, 'A': 30, 'B': 60, 'C': 90, 'D': 180,
  Hot: 14, Warm: 30, Cool: 60, Cold: 180,
};

function cadenceFor(category: string | null): number {
  return CATEGORY_CADENCE[category ?? ''] ?? 60;
}

function daysSinceIso(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000);
}

function buildAlerts(inputs: CoachingInputs): Alert[] {
  const now = new Date().toISOString();
  const alerts: Alert[] = [];

  // Aggregate: overdue_touch. Contacts past 2× their cadence, or A-cat never touched.
  const overdueContacts = inputs.contacts.filter(c => {
    const cadence = cadenceFor(c.category);
    const d = daysSinceIso(c.last_activity_date);
    if (d === null) return ['A-Plus', 'A', 'Hot'].includes(c.category ?? '');
    return d > cadence * 2;
  });
  if (overdueContacts.length > 0) {
    const aCategoryOverdue = overdueContacts.filter(c => ['A-Plus', 'A', 'Hot'].includes(c.category ?? ''));
    const sample = aCategoryOverdue.slice(0, 2).map(shortName);
    const suffix = sample.length > 0
      ? ` Two A-category names on the list: ${sample.join(', ')}.`
      : '';
    alerts.push({
      level: aCategoryOverdue.length >= 3 ? 'warning' : 'info',
      type: 'overdue_touch',
      message: `${overdueContacts.length} contacts haven't heard from you in a while.${suffix}`,
      count: overdueContacts.length,
      created_at: now,
    });
  }

  // Individual: stuck_deal. Active opportunities > 21 days in stage. Cap 5.
  const stuckDeals = inputs.active_opportunities
    .filter(o => (o.days_in_current_stage ?? 0) > 21)
    .sort((a, b) => (b.deal_value ?? 0) - (a.deal_value ?? 0))
    .slice(0, 5);

  for (const opp of stuckDeals) {
    const contact = inputs.contacts.find(c => c.id === opp.contact_id);
    const name = contact ? shortName(contact) : 'This deal';
    const stageLabel = opp.stage.replace(/_/g, ' ');
    const dealK = opp.deal_value ? ` ($${Math.round(opp.deal_value / 1000)}k)` : '';
    alerts.push({
      level: (opp.deal_value ?? 0) > 500_000 ? 'urgent' : 'warning',
      type: 'stuck_deal',
      message: `${name}${dealK} has been in ${stageLabel} for ${opp.days_in_current_stage} days. Worth a nudge or reclassify.`,
      contact_id: opp.contact_id,
      opportunity_id: opp.id,
      created_at: now,
    });
  }

  // Individual: life_event. Set AND no activity in 14d. Cap 3.
  const lifeEventContacts = inputs.contacts
    .filter(c => {
      if (!c.life_event) return false;
      const d = daysSinceIso(c.last_activity_date);
      return d === null || d >= 14;
    })
    .slice(0, 3);

  for (const c of lifeEventContacts) {
    alerts.push({
      level: ['A-Plus', 'A', 'Hot'].includes(c.category ?? '') ? 'urgent' : 'warning',
      type: 'life_event',
      message: `${shortName(c)} — ${c.life_event?.replace(/_/g, ' ')}. Window for a personal touch.`,
      contact_id: c.id,
      created_at: now,
    });
  }

  // Individual: high_priority_ignored. score >= 70 but not recently touched. Cap 3.
  const highPriorityIgnored = inputs.contacts
    .filter(c => (c.priority_score ?? 0) >= 70)
    .filter(c => {
      const d = daysSinceIso(c.last_activity_date);
      return d === null || d > 14;
    })
    .sort((a, b) => (b.priority_score ?? 0) - (a.priority_score ?? 0))
    .slice(0, 3);

  for (const c of highPriorityIgnored) {
    const d = daysSinceIso(c.last_activity_date);
    const touchPhrase = d === null ? 'never contacted' : `last touch ${d} days ago`;
    alerts.push({
      level: 'warning',
      type: 'high_priority_ignored',
      message: `Priority ${c.priority_score} — ${shortName(c)} — but ${touchPhrase}.`,
      contact_id: c.id,
      created_at: now,
    });
  }

  // Individual: opportunity_no_next_step. Cap 3.
  const noNextStep = inputs.active_opportunities
    .filter(o => !o.next_step_title)
    .slice(0, 3);

  for (const opp of noNextStep) {
    const contact = inputs.contacts.find(c => c.id === opp.contact_id);
    const name = contact ? shortName(contact) : 'A deal';
    alerts.push({
      level: 'info',
      type: 'opportunity_no_next_step',
      message: `${name} has no next step set. Define one before the deal drifts.`,
      contact_id: opp.contact_id,
      opportunity_id: opp.id,
      created_at: now,
    });
  }

  // Rank by severity, cap at 8
  const LEVEL_ORDER: Record<Alert['level'], number> = { urgent: 0, warning: 1, info: 2 };
  return alerts
    .sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level])
    .slice(0, 8);
}

// ─── Phase 3 — Prioritize (B4) — Grok call with voice-calibrated prompt ─────

interface TodayItem {
  contact_id: string;
  contact_name: string;
  opportunity_id?: string | null;
  priority_score: number | null;
  action: 'call' | 'text' | 'email' | 'meet' | 'send_listing' | 'follow_up' | 'write_note';
  reasoning: string;
  quick_actions: string[];
}

interface NextHour {
  contact_id: string;
  contact_name: string;
  opportunity_id?: string | null;
  action: TodayItem['action'];
  urgency: 'overdue' | 'timely' | 'proactive';
  reasoning: string;
  first_sentence: string;
  context_chips: string[];
}

interface Candidate {
  contact_id: string;
  name: string;
  category: string | null;
  priority_score: number | null;
  priority_reasoning: string | null;
  days_since_touch: number | null;
  last_activity_type: string | null;
  life_event: string | null;
  zip_code: string | null;
  market_pulse: MarketPulse | null;
  active_opportunity: {
    opportunity_id: string;
    stage: string;
    days_in_stage: number | null;
    deal_value: number | null;
    next_step: string | null;
  } | null;
  matched_alerts: string[]; // alert types this contact appears in
}

const COACH_VOICE_PROMPT = `You are a real-estate agent's coach. From a list of candidate contacts with priority scores, signals, and active alerts, produce today's prioritized action list (5-8 items) and designate ONE as next_hour — the single most time-critical action right now.

VOICE RULES (follow all):
- Specific over generic: "Call Maria — her daughter just graduated" beats "Reach out to Maria"
- Coach, not commander: "If I were you, I'd lead with the comp" beats "Lead with the comp"
- Brief: one sentence of reasoning per item. Agents read between showings.
- Warm, never cute: no exclamation marks unless there's actual urgency. No "Hey there!"
- No jargon. Banned: engagement, leverage, stakeholder, synergy, optimize, robust, journey, ecosystem.
- First person sparingly: "I noticed her listing went pending" is fine occasionally.
- Cite the signal: never assert without saying why.
- Probabilistic about people: "She might be ready to list" not "She is ready to list".

FIRST-SENTENCE OPENER — pick based on signal weight:
- Strong fresh signal (life event, market move, listing change): lead with the signal.
  Example: "Maria — saw your sister-in-law's place at 20012 just sold for $1.1M. Wanted you to hear first."
- Cadence touch, no fresh signal: warm-relational with soft why.
  Example: "Hi Maria — been thinking about you. The kids must be wrapping up the school year. Free for a quick coffee?"
- Long-dormant contact: low-pressure, no agenda.
  Example: "Hi Maria — it's been a minute. Hope life's good. No agenda, just wanted to say hi."

OUTPUT STRICTLY this JSON:
{
  "next_hour": {
    "contact_id": "<uuid>",
    "contact_name": "<name>",
    "opportunity_id": "<uuid or null>",
    "action": "call" | "text" | "email" | "meet" | "send_listing" | "follow_up" | "write_note",
    "urgency": "overdue" | "timely" | "proactive",
    "reasoning": "<ONE sentence explaining why this is the next hour>",
    "first_sentence": "<exact opener to use — 1-2 sentences max>",
    "context_chips": ["<fact 1>", "<fact 2>", "<fact 3>"]
  },
  "today_list": [
    {
      "contact_id": "<uuid>",
      "contact_name": "<name>",
      "opportunity_id": "<uuid or null>",
      "priority_score": <number>,
      "action": "...",
      "reasoning": "<ONE sentence>",
      "quick_actions": ["call", "text", "log"]
    }
  ]
}

Rules:
- Never invent data. If a signal isn't present in the input, don't cite it.
- 5-8 items for today_list. Fewer is OK if only 3-4 are truly actionable today.
- next_hour MUST be one of the today_list items (usually the most urgent).
- If candidates list is empty or everyone is low-priority: return empty today_list and null next_hour.
- Use the contact_id values from the input verbatim.
- quick_actions depends on contact data — include "call" only if phone exists (assume yes unless input says otherwise), "text" same, "log" always.`;

function buildCandidates(inputs: CoachingInputs, alerts: Alert[]): Candidate[] {
  // Alerts indexed by contact_id for matching
  const alertsByContact = new Map<string, string[]>();
  for (const a of alerts) {
    if (!a.contact_id) continue;
    const list = alertsByContact.get(a.contact_id) ?? [];
    list.push(a.type);
    alertsByContact.set(a.contact_id, list);
  }

  // Opportunities indexed by contact_id (prefer most-progressed stage)
  const oppByContact = new Map<string, OpportunityRow>();
  for (const o of inputs.active_opportunities) {
    const existing = oppByContact.get(o.contact_id);
    if (!existing) oppByContact.set(o.contact_id, o);
  }

  const now = Date.now();
  const candidates = inputs.contacts
    .filter(c => !c.dnc) // Respect DNC — coaching doesn't drive calls to DNC contacts
    .map<Candidate>(c => {
      const daysSince = c.last_activity_date
        ? Math.floor((now - new Date(c.last_activity_date).getTime()) / 86400_000)
        : null;
      const opp = oppByContact.get(c.id) ?? null;
      return {
        contact_id: c.id,
        name: shortName(c),
        category: c.category,
        priority_score: c.priority_score,
        priority_reasoning: c.priority_reasoning,
        days_since_touch: daysSince,
        last_activity_type: null,
        life_event: c.life_event,
        zip_code: c.zip_code,
        market_pulse: c.zip_code ? (inputs.market_pulse[c.zip_code] ?? null) : null,
        active_opportunity: opp ? {
          opportunity_id: opp.id,
          stage: opp.stage.replace(/_/g, ' '),
          days_in_stage: opp.days_in_current_stage,
          deal_value: opp.deal_value,
          next_step: opp.next_step_title,
        } : null,
        matched_alerts: alertsByContact.get(c.id) ?? [],
      };
    })
    // Rank by priority_score DESC (null last), then by matched_alerts count, then overdue touch
    .sort((a, b) => {
      const pa = a.priority_score ?? -1;
      const pb = b.priority_score ?? -1;
      if (pa !== pb) return pb - pa;
      if (a.matched_alerts.length !== b.matched_alerts.length) return b.matched_alerts.length - a.matched_alerts.length;
      const da = a.days_since_touch ?? -1;
      const db = b.days_since_touch ?? -1;
      return db - da;
    })
    .slice(0, 30); // Cap context: top-30 only. Cheaper Grok call, enough signal.

  return candidates;
}

function mechanicalFallback(inputs: CoachingInputs, alerts: Alert[]): { next_hour: NextHour | null; today_list: TodayItem[] } {
  // Used when Grok is unavailable. Deterministic top-8 by priority_score with templated reasoning.
  const candidates = buildCandidates(inputs, alerts);
  const top8 = candidates.slice(0, 8);
  const today_list: TodayItem[] = top8.map(c => ({
    contact_id: c.contact_id,
    contact_name: c.name,
    opportunity_id: c.active_opportunity?.opportunity_id ?? null,
    priority_score: c.priority_score,
    action: c.active_opportunity ? 'follow_up' : 'call',
    reasoning: c.priority_reasoning ?? (c.days_since_touch !== null
      ? `Priority ${c.priority_score ?? '?'}; last touch ${c.days_since_touch} days ago.`
      : `Priority ${c.priority_score ?? '?'}; never contacted.`),
    quick_actions: ['call', 'text', 'log'],
  }));

  const nextHour: NextHour | null = top8.length > 0 ? {
    contact_id: top8[0].contact_id,
    contact_name: top8[0].name,
    opportunity_id: top8[0].active_opportunity?.opportunity_id ?? null,
    action: top8[0].active_opportunity ? 'follow_up' : 'call',
    urgency: (top8[0].days_since_touch ?? 0) > 30 ? 'overdue' : 'timely',
    reasoning: today_list[0].reasoning,
    first_sentence: `Hi ${top8[0].name.split(' ')[0]} — it's been a minute. Hope life's good.`,
    context_chips: [
      top8[0].category ? `Category ${top8[0].category}` : '',
      top8[0].priority_score ? `Priority ${top8[0].priority_score}` : '',
      top8[0].days_since_touch !== null ? `${top8[0].days_since_touch}d since touch` : '',
    ].filter(Boolean),
  } : null;

  return { next_hour: nextHour, today_list };
}

async function prioritize(
  inputs: CoachingInputs,
  alerts: Alert[],
  xaiKey: string,
  model: string,
): Promise<{ next_hour: NextHour | null; today_list: TodayItem[]; tokens_in: number; tokens_out: number; used_fallback: boolean; }> {
  const candidates = buildCandidates(inputs, alerts);

  if (candidates.length === 0) {
    return { next_hour: null, today_list: [], tokens_in: 0, tokens_out: 0, used_fallback: false };
  }

  if (!xaiKey) {
    console.warn('XAI_API_KEY not set — using mechanical fallback for prioritize');
    return { ...mechanicalFallback(inputs, alerts), tokens_in: 0, tokens_out: 0, used_fallback: true };
  }

  try {
    const userPayload = {
      agent_name: inputs.agent_name,
      current_time: new Date().toISOString(),
      sphere_overview: {
        total_contacts: inputs.aggregates.contact_count,
        overdue_30d: inputs.aggregates.contacts_overdue_30d,
        active_deals: inputs.aggregates.active_opportunity_count,
        pipeline_value: inputs.aggregates.pipeline_value,
      },
      active_alerts: alerts.slice(0, 8),
      candidates,
    };

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + xaiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: COACH_VOICE_PROMPT },
          { role: 'user', content: JSON.stringify(userPayload) },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 3500,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Grok prioritize failed', response.status, text.slice(0, 200));
      return { ...mechanicalFallback(inputs, alerts), tokens_in: 0, tokens_out: 0, used_fallback: true };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? '{}';
    const usage = data.usage ?? {};

    let parsed: { next_hour?: NextHour | null; today_list?: TodayItem[] };
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error('Non-JSON Grok response', content.slice(0, 200));
      return { ...mechanicalFallback(inputs, alerts), tokens_in: usage.prompt_tokens ?? 0, tokens_out: usage.completion_tokens ?? 0, used_fallback: true };
    }

    // Sanity check: ensure all contact_ids in the response exist in the input.
    // Drop any invented items (paranoid against hallucinated UUIDs).
    const validContactIds = new Set(candidates.map(c => c.contact_id));
    const cleanedTodayList = (parsed.today_list ?? [])
      .filter(item => item && validContactIds.has(item.contact_id))
      .slice(0, 8);
    const cleanedNextHour = parsed.next_hour && validContactIds.has(parsed.next_hour.contact_id)
      ? parsed.next_hour
      : null;

    return {
      next_hour: cleanedNextHour,
      today_list: cleanedTodayList,
      tokens_in: usage.prompt_tokens ?? 0,
      tokens_out: usage.completion_tokens ?? 0,
      used_fallback: false,
    };
  } catch (e) {
    console.error('Prioritize threw', (e as Error).message);
    return { ...mechanicalFallback(inputs, alerts), tokens_in: 0, tokens_out: 0, used_fallback: true };
  }
}

// ─── Phase 4 — Weekly narrative (B5) — STUB ──────────────────────────────────
async function writeNarrative(_inputs: CoachingInputs, _xaiKey: string, _model: string): Promise<{ narrative: unknown | null; tokens_in: number; tokens_out: number; }> {
  return { narrative: null, tokens_in: 0, tokens_out: 0 }; // B5 fills this
}

// ─── Phase 5 — Persist ───────────────────────────────────────────────────────

interface CoachState {
  next_hour: unknown | null;
  today_list: unknown[];
  week_narrative: unknown | null;
  alerts: unknown[];
  chat_context: unknown | null;
  model: string;
  tokens_in: number;
  tokens_out: number;
  run_ms: number;
}

async function persist(supabase: ReturnType<typeof createClient>, agentId: UUID, state: CoachState): Promise<void> {
  // Use UPDATE (not upsert) — row exists from B1 pre-population OR was created
  // earlier by ensureRowExists() below.
  const { error } = await supabase
    .from('agent_coaching_state')
    .update({
      next_hour: state.next_hour,
      today_list: state.today_list,
      week_narrative: state.week_narrative,
      alerts: state.alerts,
      chat_context: state.chat_context,
      model: state.model,
      tokens_in: state.tokens_in,
      tokens_out: state.tokens_out,
      run_ms: state.run_ms,
      generated_at: new Date().toISOString(),
      dirty: false,
    })
    .eq('agent_id', agentId);

  if (error) throw new Error(`persist: ${error.message}`);

  // Bump version separately so we don't have to read-then-write
  await supabase.rpc('increment_coaching_state_version', { p_agent_id: agentId }).then(({ error: e }) => {
    if (e && !e.message.includes('does not exist')) {
      console.warn('version bump skipped:', e.message);
    }
  });
}

async function ensureRowExists(supabase: ReturnType<typeof createClient>, agentId: UUID): Promise<void> {
  // For new agents not in the B1 pre-population: insert a dirty row.
  await supabase
    .from('agent_coaching_state')
    .insert({ agent_id: agentId, dirty: true })
    .then(({ error }) => {
      // Ignore unique violation — row already exists, that's fine
      if (error && !error.message.includes('duplicate key')) {
        console.warn('ensureRowExists:', error.message);
      }
    });
}

// ─── One-tick orchestrator ───────────────────────────────────────────────────

async function tickAgent(
  supabase: ReturnType<typeof createClient>,
  agentId: UUID,
  xaiKey: string,
  model: string,
): Promise<{ agent_id: UUID; status: 'ok' | 'error'; message?: string; ms: number }> {
  const start = Date.now();
  try {
    await ensureRowExists(supabase, agentId);
    const inputs = await gather(supabase, agentId);

    const alerts = buildAlerts(inputs);
    const prio = await prioritize(inputs, alerts, xaiKey, model);
    const narr = await writeNarrative(inputs, xaiKey, model);

    // Stub chat_context — for now, a compact summary so we can verify gathering worked
    const chatContext = {
      agent_name: inputs.agent_name,
      sphere_size: inputs.aggregates.contact_count,
      active_deals: inputs.aggregates.active_opportunity_count,
      pipeline_value: inputs.aggregates.pipeline_value,
      overdue_30d: inputs.aggregates.contacts_overdue_30d,
      stuck_deals: inputs.aggregates.stuck_deals_count,
      top_zips: Object.keys(inputs.market_pulse).slice(0, 5),
      recent_activity_count: inputs.recent_activities.length,
      generated_at: new Date().toISOString(),
    };

    await persist(supabase, agentId, {
      next_hour: prio.next_hour,
      today_list: prio.today_list,
      week_narrative: narr.narrative,
      alerts,
      chat_context: chatContext,
      model,
      tokens_in: prio.tokens_in + narr.tokens_in,
      tokens_out: prio.tokens_out + narr.tokens_out,
      run_ms: Date.now() - start,
    });

    return { agent_id: agentId, status: 'ok', ms: Date.now() - start };
  } catch (e) {
    const message = (e as Error).message;
    console.error(`tickAgent ${agentId} failed:`, message);
    return { agent_id: agentId, status: 'error', message, ms: Date.now() - start };
  }
}

// ─── Main handler ────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  // Env
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const xaiKey = Deno.env.get('XAI_API_KEY') ?? ''; // empty OK during B2 (no AI calls yet)
  const model = Deno.env.get('XAI_MODEL') ?? 'grok-4-1-fast-reasoning';

  if (!supabaseUrl || !supabaseServiceKey) return json({ error: 'Missing Supabase env' }, 500);

  // Auth
  const isCron = req.headers.get('X-Cron-Job') === 'true' || req.headers.get('source') === 'pg_cron';
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
  const force: boolean = body.force === true;

  // Authorization guardrails
  if (!isCron && !callerIsAdmin && targetAgentId && targetAgentId !== callerAgentId) {
    return json({ error: 'Agents can only refresh their own coaching state' }, 403);
  }

  // Resolve which agents to tick
  let agentIds: UUID[] = [];
  if (targetAgentId) {
    agentIds = [targetAgentId];
  } else if (!isCron && !callerIsAdmin) {
    agentIds = [callerAgentId!];
  } else {
    // Cron / admin no filter — tick all dirty agents (or all if force)
    const query = supabase.from('agent_coaching_state').select('agent_id');
    const { data, error } = force ? await query : await query.eq('dirty', true);
    if (error) return json({ error: error.message }, 500);
    agentIds = (data ?? []).map(r => r.agent_id);
  }

  if (agentIds.length === 0) {
    return json({ message: 'No agents to refresh', ticked: 0 });
  }

  // Tick agents serially. (Parallelism deferred to B6 cron tuning.)
  const results = [];
  for (const aid of agentIds) {
    results.push(await tickAgent(supabase, aid, xaiKey, model));
  }

  return json({
    ticked: results.length,
    succeeded: results.filter(r => r.status === 'ok').length,
    failed: results.filter(r => r.status === 'error').length,
    model,
    phase: 'B4-prioritize',
    results,
  });
});
