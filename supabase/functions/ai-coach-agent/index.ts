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
  real_activities: ActivityRow[];     // rows with outcome IS NOT NULL — actual logged interactions
  scheduled_touches: ActivityRow[];   // rows from SphereSync task stubs — scheduled, not yet done
  market_pulse: Record<string, MarketPulse>;
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
  contacts_overdue_30d: number;          // based on contacts.last_activity_date — currently INCLUDES scheduled-touch updates
  contacts_overdue_90d: number;
  stuck_deals_count: number;
  unscored_contacts: number;
  real_interactions_30d: number;         // count from contact_activities WHERE outcome IS NOT NULL
  scheduled_touches_30d: number;         // count from contact_activities WHERE outcome IS NULL (SphereSync stubs)
  contacts_with_real_interaction_ever: number;
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

    // Fetch ALL contact_activities (last 30d). We split into real_activities vs
    // scheduled_touches downstream — they look the same in the schema but mean
    // very different things in this product:
    //   • outcome IS NOT NULL  → real interaction the agent logged
    //   • outcome IS NULL with notes 'SphereSync ... task created' → just a task stub
    supabase.from('contact_activities')
      .select('contact_id, activity_type, activity_date, outcome, notes')
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
  const allActivityRows = (activitiesRes.data ?? []) as Array<ActivityRow & { notes: string | null }>;

  // Split: real interactions (agent logged outcome) vs SphereSync task stubs.
  // The "task created" rows have outcome=NULL and notes starting with "SphereSync".
  function isTaskStub(row: { outcome: string | null; notes: string | null }): boolean {
    return row.outcome === null && (row.notes?.startsWith('SphereSync ') ?? false);
  }
  const realActivities = allActivityRows.filter(r => !isTaskStub(r));
  const scheduledTouches = allActivityRows.filter(isTaskStub);

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

  // Aggregates
  const now = Date.now();
  const realActivityContactIds = new Set(realActivities.map(r => r.contact_id));
  const aggregates: Aggregates = {
    contact_count: contacts.length,
    active_opportunity_count: opportunities.length,
    pipeline_value: opportunities.reduce((s, o) => s + (o.deal_value ?? 0), 0),
    gci_estimated_open: opportunities.reduce((s, o) => s + (o.deal_value ?? 0) * 0.025, 0),
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
    real_interactions_30d: realActivities.length,
    scheduled_touches_30d: scheduledTouches.length,
    contacts_with_real_interaction_ever: realActivityContactIds.size,
  };

  const profile = profileRes.data ?? { first_name: '', last_name: '' };
  return {
    agent_id: agentId,
    agent_name: `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || 'Agent',
    contacts,
    active_opportunities: opportunities,
    real_activities: realActivities,
    scheduled_touches: scheduledTouches,
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

  // Build a per-contact real-interaction index once, used by multiple rules.
  // "Real" = outcome IS NOT NULL (agent actually logged a conversation).
  const nowMs = Date.now();
  const realMostRecentByContact = new Map<string, number>();  // contact_id → latest real-activity timestamp
  for (const a of inputs.real_activities) {
    const ts = new Date(a.activity_date).getTime();
    const prev = realMostRecentByContact.get(a.contact_id);
    if (prev === undefined || ts > prev) realMostRecentByContact.set(a.contact_id, ts);
  }
  function daysSinceRealContact(contactId: string): number | null {
    const ts = realMostRecentByContact.get(contactId);
    return ts === undefined ? null : Math.floor((nowMs - ts) / 86400_000);
  }

  // Aggregate: overdue_touch. No REAL contact within 2× the SphereSync cadence.
  // The category (A-Z last-name initial) maps to a roughly-yearly cadence — we
  // treat >60d with no real interaction as overdue regardless of bucket letter.
  const overdueContacts = inputs.contacts.filter(c => {
    const d = daysSinceRealContact(c.id);
    return d === null || d > 60;
  });
  if (overdueContacts.length > 0) {
    const neverContacted = overdueContacts.filter(c => daysSinceRealContact(c.id) === null).length;
    const suffix = neverContacted > 0
      ? ` ${neverContacted} have never had a real conversation logged.`
      : '';
    alerts.push({
      level: overdueContacts.length > inputs.contacts.length * 0.5 ? 'warning' : 'info',
      type: 'overdue_touch',
      message: `${overdueContacts.length} contacts haven't had a real conversation in a while.${suffix}`,
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

  // Individual: life_event. Set AND no real contact in 14d. Cap 3.
  const lifeEventContacts = inputs.contacts
    .filter(c => {
      if (!c.life_event) return false;
      const d = daysSinceRealContact(c.id);
      return d === null || d >= 14;
    })
    .slice(0, 3);

  for (const c of lifeEventContacts) {
    alerts.push({
      level: 'urgent',
      type: 'life_event',
      message: `${shortName(c)} — ${c.life_event?.replace(/_/g, ' ')}. Window for a personal touch.`,
      contact_id: c.id,
      created_at: now,
    });
  }

  // Individual: high_priority_ignored. score >= 70 with no recent REAL contact. Cap 3.
  const highPriorityIgnored = inputs.contacts
    .filter(c => (c.priority_score ?? 0) >= 70)
    .filter(c => {
      const d = daysSinceRealContact(c.id);
      return d === null || d > 14;
    })
    .sort((a, b) => (b.priority_score ?? 0) - (a.priority_score ?? 0))
    .slice(0, 3);

  for (const c of highPriorityIgnored) {
    const d = daysSinceRealContact(c.id);
    const touchPhrase = d === null ? 'no real conversation logged' : `last real conversation ${d} days ago`;
    alerts.push({
      level: 'warning',
      type: 'high_priority_ignored',
      message: `Priority ${c.priority_score} — ${shortName(c)} — ${touchPhrase}.`,
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
  category: string | null;           // SphereSync calendar bucket = last-name initial (A-Z), drives cadence
  priority_score: number | null;
  priority_reasoning: string | null;
  // Real interaction history (outcome logged). Never confuse with scheduled touches.
  real_interaction_count_30d: number;
  real_interaction_count_90d: number;
  last_real_interaction_date: string | null;
  days_since_real_interaction: number | null;
  // SphereSync scheduled touches (task stubs — NOT real conversations)
  scheduled_touch_count_30d: number;
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
  matched_alerts: string[];
}

const COACH_VOICE_PROMPT = `You are a real-estate agent's coach. From a list of candidate contacts with priority scores, signals, and active alerts, produce today's prioritized action list (5-8 items) and designate ONE as next_hour — the single most time-critical action right now.

CRITICAL DATA-MODEL RULES (read first, these prevent hallucination):

1. "category" is the SphereSync CALENDAR-CADENCE bucket = the contact's last-name initial (A-Z). It schedules when they're called during the year. It is NOT a priority grade. Never describe a "Category B" contact as "B-tier" or "warm" — it just means their last name starts with B and they're on the B-week rotation.

2. "real_interaction_count_30d/90d" = interactions where the agent actually TALKED to the person and logged an outcome. This is the ONLY source of truth for "engagement."

3. "scheduled_touch_count_30d" = SphereSync TASK STUBS created by the system — these are NOT real conversations. A scheduled touch means "the system queued a call/text for this week." It does NOT mean the agent has contacted the person. NEVER describe a contact as "engaged" or "active" or "interested" based on scheduled_touch_count alone.

4. If real_interaction_count_90d == 0: the agent has never really spoken to this person. Your coaching must reflect that ("worth a first call", "no history yet", "fresh conversation"). Do NOT say "recent call" or "recently engaged" — those are system-generated task rows, not real contact.

5. "days_since_real_interaction" is null when no real conversation has ever been logged. Cite accordingly.

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
- **next_hour MUST be populated whenever today_list has ≥1 item.** Pick the most urgent one.
- If candidates list is empty: return empty today_list AND null next_hour.
- Use contact_id values from the input verbatim.
- quick_actions: ["call", "text", "log"] is the standard set.
- Banned words check before finalizing output: scan your reasoning + first_sentence for banned vocabulary (engagement, leverage, stakeholder, synergy, optimize, robust, journey, ecosystem). If found, rewrite that line.`;

function buildCandidates(inputs: CoachingInputs, alerts: Alert[]): Candidate[] {
  const alertsByContact = new Map<string, string[]>();
  for (const a of alerts) {
    if (!a.contact_id) continue;
    const list = alertsByContact.get(a.contact_id) ?? [];
    list.push(a.type);
    alertsByContact.set(a.contact_id, list);
  }

  // Real interactions per contact (last 30d and last 90d)
  const realByContact30d = new Map<string, ActivityRow[]>();
  const realByContact90d = new Map<string, ActivityRow[]>();
  const now = Date.now();
  const cutoff90d = now - 90 * 86400_000;
  const cutoff30d = now - 30 * 86400_000;
  for (const a of inputs.real_activities) {
    const ts = new Date(a.activity_date).getTime();
    if (ts >= cutoff90d) {
      const list90 = realByContact90d.get(a.contact_id) ?? [];
      list90.push(a);
      realByContact90d.set(a.contact_id, list90);
      if (ts >= cutoff30d) {
        const list30 = realByContact30d.get(a.contact_id) ?? [];
        list30.push(a);
        realByContact30d.set(a.contact_id, list30);
      }
    }
  }

  const scheduledByContact30d = new Map<string, number>();
  for (const s of inputs.scheduled_touches) {
    scheduledByContact30d.set(s.contact_id, (scheduledByContact30d.get(s.contact_id) ?? 0) + 1);
  }

  const oppByContact = new Map<string, OpportunityRow>();
  for (const o of inputs.active_opportunities) {
    const existing = oppByContact.get(o.contact_id);
    if (!existing) oppByContact.set(o.contact_id, o);
  }

  return inputs.contacts
    .filter(c => !c.dnc)
    .map<Candidate>(c => {
      const real90 = realByContact90d.get(c.id) ?? [];
      const real30 = realByContact30d.get(c.id) ?? [];
      const mostRecentReal = real90.reduce<string | null>((latest, a) => {
        if (!latest) return a.activity_date;
        return new Date(a.activity_date).getTime() > new Date(latest).getTime() ? a.activity_date : latest;
      }, null);
      const daysSinceReal = mostRecentReal
        ? Math.floor((now - new Date(mostRecentReal).getTime()) / 86400_000)
        : null;
      const opp = oppByContact.get(c.id) ?? null;
      return {
        contact_id: c.id,
        name: shortName(c),
        category: c.category,
        priority_score: c.priority_score,
        priority_reasoning: c.priority_reasoning,
        real_interaction_count_30d: real30.length,
        real_interaction_count_90d: real90.length,
        last_real_interaction_date: mostRecentReal,
        days_since_real_interaction: daysSinceReal,
        scheduled_touch_count_30d: scheduledByContact30d.get(c.id) ?? 0,
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
    .sort((a, b) => {
      const pa = a.priority_score ?? -1;
      const pb = b.priority_score ?? -1;
      if (pa !== pb) return pb - pa;
      if (a.matched_alerts.length !== b.matched_alerts.length) return b.matched_alerts.length - a.matched_alerts.length;
      const da = a.days_since_real_interaction ?? 9999;
      const db = b.days_since_real_interaction ?? 9999;
      return db - da; // most-overdue first
    })
    .slice(0, 30);
}

function mechanicalFallback(inputs: CoachingInputs, alerts: Alert[]): { next_hour: NextHour | null; today_list: TodayItem[] } {
  const candidates = buildCandidates(inputs, alerts);
  const top8 = candidates.slice(0, 8);
  const today_list: TodayItem[] = top8.map(c => ({
    contact_id: c.contact_id,
    contact_name: c.name,
    opportunity_id: c.active_opportunity?.opportunity_id ?? null,
    priority_score: c.priority_score,
    action: c.active_opportunity ? 'follow_up' : 'call',
    reasoning: c.real_interaction_count_90d === 0
      ? `Never had a real conversation — SphereSync queued ${c.scheduled_touch_count_30d} touches. Good time to start.`
      : c.days_since_real_interaction !== null
        ? `Priority ${c.priority_score ?? '?'}; last real conversation ${c.days_since_real_interaction} days ago.`
        : `Priority ${c.priority_score ?? '?'}; SphereSync category ${c.category ?? '?'} bucket.`,
    quick_actions: ['call', 'text', 'log'],
  }));

  const nextHour: NextHour | null = top8.length > 0 ? {
    contact_id: top8[0].contact_id,
    contact_name: top8[0].name,
    opportunity_id: top8[0].active_opportunity?.opportunity_id ?? null,
    action: top8[0].active_opportunity ? 'follow_up' : 'call',
    urgency: (top8[0].days_since_real_interaction ?? 9999) > 30 ? 'overdue' : 'timely',
    reasoning: today_list[0].reasoning,
    first_sentence: `Hi ${top8[0].name.split(' ')[0]} — it's been a minute. Hope life's good.`,
    context_chips: [
      top8[0].category ? `Category ${top8[0].category}` : '',
      top8[0].priority_score ? `Priority ${top8[0].priority_score}` : '',
      top8[0].real_interaction_count_90d === 0
        ? 'No real contact yet'
        : `${top8[0].days_since_real_interaction}d since real contact`,
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

// ─── Phase 4 — Weekly narrative (B5) — Grok call, 5 short sentences ─────────

interface WeekNarrative {
  gci_pace: string;
  pipeline_story: string;
  sphere_story: string;
  top_risk: string | null;
  top_win: string | null;
}

const NARRATIVE_PROMPT = [
  "You are a real-estate agent's coach. Write this week's narrative — 5 short sentences that tell the story of the agent's business right now. One sentence per field. No preamble, no filler, no bullet points.",
  '',
  'DATA-MODEL RULES:',
  '- real_interactions_* = conversations the agent actually logged. The only true engagement signal.',
  '- scheduled_touches_* = SphereSync task stubs generated by the system. NOT real conversations. Never describe them as "engagement" or "activity".',
  '- If real_interactions_30d == 0: the agent has not logged any real conversations this month. Say that honestly.',
  '',
  'VOICE:',
  '- Brief: one sentence per field.',
  '- Specific: cite a number or a named stage/contact.',
  '- Coach, not cheerleader: "Three deals are stuck in Pending >21 days" beats "Great momentum!"',
  '- No jargon. Banned: engagement, leverage, stakeholder, synergy, optimize, robust, journey, ecosystem.',
  '- Probabilistic: "likely", "might", not certainty.',
  '- No emoji, no exclamation marks unless urgent.',
  '',
  'OUTPUT JSON strict:',
  '{',
  '  "gci_pace": "<one sentence on revenue pace and what to push>",',
  '  "pipeline_story": "<one sentence on deal flow and what is stuck or moving>",',
  '  "sphere_story": "<one sentence on relationship health and real conversations>",',
  '  "top_risk": "<one sentence naming the biggest risk, OR null if nothing stands out>",',
  '  "top_win": "<one sentence naming the biggest momentum, OR null if nothing stands out>"',
  '}',
  '',
  'Rules:',
  '- If the data is too thin to write a field honestly, set it to null instead of fabricating.',
  '- Never quote exact priority scores or probabilities unless they help the agent decide something.',
  '- top_risk and top_win can be null. Do not force them.',
].join('\n');

async function writeNarrative(
  inputs: CoachingInputs,
  xaiKey: string,
  model: string,
): Promise<{ narrative: WeekNarrative | null; tokens_in: number; tokens_out: number; used_fallback: boolean; }> {
  // Skip narrative entirely when sphere is empty — no story to tell.
  if (inputs.contacts.length === 0) {
    return { narrative: null, tokens_in: 0, tokens_out: 0, used_fallback: false };
  }

  // Compact summary payload. Narrative doesn't need per-contact detail.
  // Most of the value is aggregates + a few named stuck deals.
  const stuckDeals = inputs.active_opportunities
    .filter(o => (o.days_in_current_stage ?? 0) > 21)
    .slice(0, 3)
    .map(o => {
      const contact = inputs.contacts.find(c => c.id === o.contact_id);
      return {
        name: contact ? shortName(contact) : 'Unknown',
        stage: o.stage.replace(/_/g, ' '),
        days_in_stage: o.days_in_current_stage,
        deal_value: o.deal_value,
      };
    });

  const topUntouched = inputs.contacts
    .filter(c => (c.priority_score ?? 0) >= 70)
    .filter(c => !inputs.real_activities.some(r => r.contact_id === c.id))
    .slice(0, 3)
    .map(c => ({ name: shortName(c), priority_score: c.priority_score, category: c.category }));

  const userPayload = {
    agent_name: inputs.agent_name,
    week_of: new Date().toISOString().slice(0, 10),
    sphere: {
      total_contacts: inputs.aggregates.contact_count,
      contacts_with_real_interaction_ever: inputs.aggregates.contacts_with_real_interaction_ever,
      real_interactions_30d: inputs.aggregates.real_interactions_30d,
      scheduled_touches_30d: inputs.aggregates.scheduled_touches_30d,
      unscored_contacts: inputs.aggregates.unscored_contacts,
    },
    pipeline: {
      active_deals: inputs.aggregates.active_opportunity_count,
      pipeline_value_usd: inputs.aggregates.pipeline_value,
      stuck_deals_count: inputs.aggregates.stuck_deals_count,
      stuck_deals_sample: stuckDeals,
    },
    top_untouched_high_priority: topUntouched,
  };

  function fallback(): WeekNarrative {
    const hasAnyDeal = inputs.aggregates.active_opportunity_count > 0;
    const hasAnyReal = inputs.aggregates.real_interactions_30d > 0;
    return {
      gci_pace: hasAnyDeal
        ? `${inputs.aggregates.active_opportunity_count} active deal(s), pipeline around $${Math.round(inputs.aggregates.pipeline_value / 1000)}k.`
        : 'No active deals yet — focus is relationship building this week.',
      pipeline_story: hasAnyDeal
        ? `${inputs.aggregates.stuck_deals_count} deal(s) have been in the same stage >21 days.`
        : 'No pipeline activity to report — this is a relationship-building phase.',
      sphere_story: hasAnyReal
        ? `${inputs.aggregates.real_interactions_30d} real conversations logged across ${inputs.aggregates.contacts_with_real_interaction_ever} contacts in the last 30 days.`
        : `${inputs.aggregates.contact_count} contacts in the sphere, no real conversations logged in the last 30 days.`,
      top_risk: null,
      top_win: null,
    };
  }

  if (!xaiKey) {
    return { narrative: fallback(), tokens_in: 0, tokens_out: 0, used_fallback: true };
  }

  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + xaiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: NARRATIVE_PROMPT },
          { role: 'user', content: JSON.stringify(userPayload) },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.35,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Grok narrative failed', response.status, text.slice(0, 200));
      return { narrative: fallback(), tokens_in: 0, tokens_out: 0, used_fallback: true };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? '{}';
    const usage = data.usage ?? {};
    let parsed: Partial<WeekNarrative>;
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error('Non-JSON Grok narrative response', content.slice(0, 200));
      return { narrative: fallback(), tokens_in: usage.prompt_tokens ?? 0, tokens_out: usage.completion_tokens ?? 0, used_fallback: true };
    }

    const narrative: WeekNarrative = {
      gci_pace: parsed.gci_pace ?? fallback().gci_pace,
      pipeline_story: parsed.pipeline_story ?? fallback().pipeline_story,
      sphere_story: parsed.sphere_story ?? fallback().sphere_story,
      top_risk: parsed.top_risk ?? null,
      top_win: parsed.top_win ?? null,
    };

    return {
      narrative,
      tokens_in: usage.prompt_tokens ?? 0,
      tokens_out: usage.completion_tokens ?? 0,
      used_fallback: false,
    };
  } catch (e) {
    console.error('writeNarrative threw', (e as Error).message);
    return { narrative: fallback(), tokens_in: 0, tokens_out: 0, used_fallback: true };
  }
}

// ─── Phase 4.5 — writeCoachTasks (B5.7) ──────────────────────────────────────
// Turns today_list items into real task rows in spheresync_tasks (relationship
// touches) or pipeline_tasks (deal nudges). Dedup against Coach tasks in the
// last 7 days for same contact + task_type. Cap at maxNewTasks per tick.
// Uses the source + coach_* columns added in B5.5.

function normalizeTaskType(action: string): string {
  const map: Record<string, string> = {
    call: 'call', text: 'text', email: 'email',
    meet: 'meeting', send_listing: 'email', follow_up: 'call',
    write_note: 'note',
  };
  return map[action] ?? 'call';
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

function isoWeekFor(d: Date): { weekNumber: number; year: number } {
  const target = new Date(d);
  target.setUTCHours(0, 0, 0, 0);
  target.setUTCDate(target.getUTCDate() + 4 - (target.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil((((target.getTime() - yearStart.getTime()) / 86400_000) + 1) / 7);
  return { weekNumber, year: target.getUTCFullYear() };
}

interface WriteCoachTasksResult { created: number; skipped_dedup: number; skipped_cap: number; errors: number; }

async function writeCoachTasks(
  supabase: ReturnType<typeof createClient>,
  agentId: UUID,
  todayList: TodayItem[],
  opts: { enabled: boolean; maxNewTasks: number },
): Promise<WriteCoachTasksResult> {
  const result: WriteCoachTasksResult = { created: 0, skipped_dedup: 0, skipped_cap: 0, errors: 0 };
  if (!opts.enabled || todayList.length === 0) return result;

  const since7d = new Date(Date.now() - 7 * 86400_000).toISOString();
  const [sphereRes, pipeRes] = await Promise.all([
    supabase.from('spheresync_tasks').select('lead_id, task_type').eq('agent_id', agentId).eq('source', 'coach').gte('coach_created_at', since7d).is('coach_dismissed_at', null),
    supabase.from('pipeline_tasks').select('contact_id, task_type').eq('agent_id', agentId).eq('source', 'coach').gte('coach_created_at', since7d).is('coach_dismissed_at', null),
  ]);

  const existingKeys = new Set<string>();
  for (const t of (sphereRes.data ?? [])) existingKeys.add(`sphere:${t.lead_id}:${t.task_type}`);
  for (const t of (pipeRes.data ?? [])) existingKeys.add(`pipeline:${t.contact_id}:${t.task_type}`);

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const { weekNumber, year } = isoWeekFor(now);

  for (const item of todayList) {
    if (result.created >= opts.maxNewTasks) {
      result.skipped_cap++;
      continue;
    }
    const taskType = normalizeTaskType(item.action);
    const isPipeline = !!item.opportunity_id;
    const dedupKey = isPipeline
      ? `pipeline:${item.contact_id}:${taskType}`
      : `sphere:${item.contact_id}:${taskType}`;
    if (existingKeys.has(dedupKey)) {
      result.skipped_dedup++;
      continue;
    }

    try {
      if (isPipeline) {
        const { error } = await supabase.from('pipeline_tasks').insert({
          agent_id: agentId,
          opportunity_id: item.opportunity_id,
          contact_id: item.contact_id,
          task_type: taskType,
          title: truncate(item.reasoning, 120),
          description: item.reasoning,
          due_date: today,
          priority: 2,
          source: 'coach',
          coach_reasoning: item.reasoning,
          coach_created_at: now.toISOString(),
          ai_suggested: true,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('spheresync_tasks').insert({
          agent_id: agentId,
          lead_id: item.contact_id,
          task_type: taskType,
          week_number: weekNumber,
          year,
          completed: false,
          source: 'coach',
          coach_reasoning: item.reasoning,
          coach_created_at: now.toISOString(),
          notes: '[Coach] ' + truncate(item.reasoning, 200),
        });
        if (error) throw error;
      }
      result.created++;
      existingKeys.add(dedupKey);
    } catch (e) {
      result.errors++;
      console.error('writeCoachTasks insert failed:', (e as Error).message);
    }
  }

  return result;
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

    // B5.7 — write tasks from today_list. Cap 5 per tick, dedup via 7-day
    // Coach-task window. Gated via coachWriteTasks flag so B6 can disable on
    // workday-quick ticks and only let the nightly-full tick create tasks.
    const coachTasks = await writeCoachTasks(
      supabase, agentId, prio.today_list as TodayItem[],
      { enabled: true, maxNewTasks: 5 },
    );

    const chatContext = {
      agent_name: inputs.agent_name,
      sphere_size: inputs.aggregates.contact_count,
      active_deals: inputs.aggregates.active_opportunity_count,
      pipeline_value: inputs.aggregates.pipeline_value,
      overdue_30d: inputs.aggregates.contacts_overdue_30d,
      stuck_deals: inputs.aggregates.stuck_deals_count,
      top_zips: Object.keys(inputs.market_pulse).slice(0, 5),
      real_interactions_30d: inputs.aggregates.real_interactions_30d,
      scheduled_touches_30d: inputs.aggregates.scheduled_touches_30d,
      contacts_with_real_interaction_ever: inputs.aggregates.contacts_with_real_interaction_ever,
      used_fallback: prio.used_fallback,
      coach_tasks_created: coachTasks.created,
      coach_tasks_skipped_dedup: coachTasks.skipped_dedup,
      coach_tasks_skipped_cap: coachTasks.skipped_cap,
      coach_task_errors: coachTasks.errors,
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
    phase: 'B5.7-coach-tasks',
    results,
  });
});
