/**
 * compute-priority-scores
 *
 * Unified Priority Score engine — Phase 1 of the REOP AI-first Hub.
 *
 * Computes a 0–100 priority score for every active contact by blending:
 *   • Relationship health (SphereSync cadence adherence + recency)
 *   • Pipeline momentum  (active opportunity state + AI probability)
 *   • AI intent          (Grok-synthesized from market pulse + life events + engagement)
 *   • Agent flags        (VIP / pre-approval / explicit watch)
 *
 * Weights (normalize when a component is N/A):
 *   • With active opportunity:    35 / 30 / 25 / 10
 *   • Without active opportunity: 50 /  0 / 40 / 10   (pipeline → relationship + intent)
 *
 * Invocation
 *   POST /functions/v1/compute-priority-scores
 *     {}                          ← cron (all agents, all active contacts)
 *     { agent_id }                ← one agent's full sphere
 *     { contact_ids: [uuid,...] } ← event-driven recompute (e.g. activity logged)
 *
 * Auth
 *   • cron:  X-Cron-Job: true  OR  source: pg_cron   (no user auth required)
 *   • user:  bearer token; admin can target any agent, agent can target own contacts only
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';
import { corsHeaders } from '../_shared/cors.ts';

// ─── Types ────────────────────────────────────────────────────────────────────

type UUID = string;

interface ContactRow {
  id: UUID;
  agent_id: UUID;
  first_name: string | null;
  last_name: string | null;
  category: string | null;
  zip_code: string | null;
  tags: string[] | null;
  last_activity_date: string | null;
  activity_count: number | null;
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
  ai_deal_probability: number | null;
  deal_value: number | null;
}

interface ActivitySummary {
  last_90d_count: number;
  last_30d_count: number;
  most_recent_at: string | null;
  most_recent_type: string | null;
}

interface MarketPulse {
  zip: string;
  median_price: number | null;
  inventory_trend: string | null;
  dom: number | null;
}

interface IntentResult {
  contact_id: UUID;
  intent_score: number;         // 0-100
  reasoning: string;            // one sentence
  key_signals: string[];        // 2-3 short phrases
}

// ─── Mechanical scorers (deterministic, no AI) ───────────────────────────────

/** 0-100. Blends cadence adherence and activity volume. */
function relationshipScore(
  daysSinceLast: number | null,
  activity30d: number,
  activity90d: number,
  category: string | null,
): number {
  // Days between expected touches per category.
  const cadence: Record<string, number> = {
    'A-Plus': 14, 'A': 30, 'B': 60, 'C': 90, 'D': 180,
    Hot: 14, Warm: 30, Cool: 60, Cold: 180,
  };
  const target = cadence[category ?? ''] ?? 60;

  if (daysSinceLast === null) {
    // Never touched — neutral-low, no hard penalty (could be a brand-new import)
    return 30;
  }

  const ratio = daysSinceLast / target;
  let base: number;
  if (ratio <= 0.5)      base = 92;
  else if (ratio <= 1.0) base = 78;
  else if (ratio <= 1.5) base = 58;
  else if (ratio <= 2.5) base = 38;
  else                   base = 15;

  // Volume bonus — agents who work a contact consistently get credit
  if (activity30d >= 3)      base = Math.min(100, base + 8);
  else if (activity90d >= 5) base = Math.min(100, base + 4);

  return base;
}

/** 0-100, or null if no active opportunity (pipeline weight gets redistributed). */
function pipelineScore(opp: OpportunityRow | null): number | null {
  if (!opp) return null;
  if (opp.outcome === 'lost' || opp.outcome === 'withdrawn') return null;

  // Stage baseline if AI probability isn't set yet
  const stageBaseline: Record<string, number> = {
    new_lead: 20, nurturing: 25,
    active_search: 48, pre_listing: 48,
    showing: 58, listing_appt: 58,
    listed_active: 62,
    offer_submitted: 78, offer_received: 78,
    under_contract: 88,
    closed_won: 100,
    // Referral ladder
    referral_received: 30, contacted: 50, active: 65, referral_sent: 55,
  };

  let score = opp.ai_deal_probability != null
    ? Math.round(opp.ai_deal_probability * 100)
    : (stageBaseline[opp.stage] ?? 40);

  // Staleness penalty — stuck deals degrade
  if ((opp.days_in_current_stage ?? 0) > 30)      score = Math.max(0, score - 18);
  else if ((opp.days_in_current_stage ?? 0) > 14) score = Math.max(0, score - 8);

  return Math.min(100, Math.max(0, score));
}

/** 0-100. VIP / pre-approval / explicit watch flag. */
function flagsScore(contact: ContactRow): number {
  let score = 30; // neutral baseline
  if (contact.priority_watch_flag) score += 25;
  if (contact.buyer_pre_approval_status === 'approved') score += 25;
  if ((contact.tags ?? []).some(t => t.toUpperCase() === 'VIP')) score += 20;
  if (contact.motivation_score != null && contact.motivation_score >= 7) score += 10;
  return Math.min(100, score);
}

/** Blend component scores → final 0-100 plus the weighted breakdown. */
function blend(c: {
  relationship: number;
  pipeline: number | null;
  intent: number;
  flags: number;
}) {
  const weights = c.pipeline === null
    ? { relationship: 0.50, pipeline: 0, intent: 0.40, flags: 0.10 }
    : { relationship: 0.35, pipeline: 0.30, intent: 0.25, flags: 0.10 };

  const weighted = {
    relationship: Math.round(c.relationship * weights.relationship),
    pipeline:     Math.round((c.pipeline ?? 0) * weights.pipeline),
    intent:       Math.round(c.intent * weights.intent),
    flags:        Math.round(c.flags * weights.flags),
  };

  const score = Math.min(100, Math.max(0,
    weighted.relationship + weighted.pipeline + weighted.intent + weighted.flags
  ));

  return { score, weighted };
}

// ─── Grok batched intent scoring ──────────────────────────────────────────────

const INTENT_SYSTEM_PROMPT = `You score real-estate contacts on their CURRENT INTENT to transact (buy or sell a home) on a 0–100 scale.

Inputs (per contact): category, ZIP, life_event, recent engagement summary, market pulse for their ZIP, active opportunity summary if any.

Output a JSON object with "results" being an ARRAY, one entry per contact, in the SAME ORDER as input:
{
  "results": [
    {
      "contact_id": "<uuid copied from input>",
      "intent_score": <0-100 integer>,
      "reasoning": "<ONE short sentence explaining the score — concrete, cite the signal>",
      "key_signals": ["<2-3 very short phrases naming the signals>"]
    }
  ]
}

Scoring guide:
  0-20  — dormant, no current signals
 21-40  — warm sphere, no near-term transaction
 41-60  — signs of interest (life event or market trigger)
 61-80  — actively considering (engagement + signal convergence)
 81-100 — urgent (multiple signals + short timeline)

Rules: be concrete; cite the specific signal; never invent data; real-estate agent's POV; short sentences; no em-dashes; no emoji.`;

interface GrokIntentInput {
  contact_id: UUID;
  category: string | null;
  zip: string | null;
  life_event: string | null;
  engagement: { last_30d: number; last_90d: number; most_recent_type: string | null; most_recent_days_ago: number | null };
  market: MarketPulse | null;
  active_opportunity: { stage: string; days_in_stage: number | null; probability: number | null; deal_value: number | null } | null;
}

async function scoreIntentBatch(
  xaiKey: string,
  model: string,
  batch: GrokIntentInput[],
): Promise<IntentResult[]> {
  if (batch.length === 0) return [];

  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${xaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: INTENT_SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify({ contacts: batch }) },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: Math.min(4000, 180 * batch.length + 200),
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`xAI ${response.status}: ${text.slice(0, 200)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? '{}';
  let parsed: { results?: IntentResult[] };
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(`Non-JSON Grok response: ${content.slice(0, 200)}`);
  }

  const results = Array.isArray(parsed.results) ? parsed.results : [];
  // Clamp scores defensively
  return results.map(r => ({
    contact_id: r.contact_id,
    intent_score: Math.max(0, Math.min(100, Math.round(r.intent_score))),
    reasoning: (r.reasoning ?? '').slice(0, 300),
    key_signals: Array.isArray(r.key_signals) ? r.key_signals.slice(0, 3) : [],
  }));
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
  const xaiKey = Deno.env.get('XAI_API_KEY');
  const model = Deno.env.get('XAI_MODEL') ?? 'grok-4-1-fast-reasoning';

  if (!supabaseUrl || !supabaseServiceKey) return json({ error: 'Missing Supabase env' }, 500);
  if (!xaiKey) return json({ error: 'XAI_API_KEY not configured' }, 500);

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

  // Authorization guardrails
  if (!isCron && !callerIsAdmin) {
    if (targetAgentId && targetAgentId !== callerAgentId) {
      return json({ error: 'Agents can only score their own contacts' }, 403);
    }
  }

  // ── Resolve target contacts ────────────────────────────────────────────────
  let contactsQuery = supabase
    .from('contacts')
    .select(`
      id, agent_id, first_name, last_name, category, zip_code, tags,
      last_activity_date, activity_count, life_event,
      buyer_pre_approval_status, motivation_score, priority_watch_flag
    `);

  if (targetContactIds && targetContactIds.length > 0) {
    contactsQuery = contactsQuery.in('id', targetContactIds);
  } else if (targetAgentId) {
    contactsQuery = contactsQuery.eq('agent_id', targetAgentId);
  } else if (!isCron && !callerIsAdmin) {
    contactsQuery = contactsQuery.eq('agent_id', callerAgentId!);
  }
  // else (cron or admin with no filter): score everyone — RLS is bypassed by service role

  const { data: contacts, error: contactsErr } = await contactsQuery;
  if (contactsErr) return json({ error: contactsErr.message }, 500);
  if (!contacts || contacts.length === 0) return json({ scored: 0, results: [] });

  const contactIds = contacts.map(c => c.id);

  // ── Gather inputs in parallel ──────────────────────────────────────────────
  const [activitiesRes, opportunitiesRes, marketRes] = await Promise.all([
    supabase
      .from('contact_activities')
      .select('contact_id, activity_type, activity_date')
      .in('contact_id', contactIds)
      .gte('activity_date', new Date(Date.now() - 90 * 86400_000).toISOString()),
    supabase
      .from('opportunities')
      .select('id, contact_id, stage, outcome, days_in_current_stage, ai_deal_probability, deal_value, actual_close_date')
      .in('contact_id', contactIds)
      .is('actual_close_date', null),
    // Market pulse — one row per ZIP from the active CSV
    supabase
      .from('newsletter_market_data')
      .select('zip_code, median_sale_price, inventory, median_dom')
      .in('zip_code', Array.from(new Set(contacts.map(c => c.zip_code).filter((z): z is string => !!z)))),
  ]);

  // ── Index lookups ──────────────────────────────────────────────────────────
  const activityByContact = new Map<UUID, ActivitySummary>();
  const now = Date.now();
  for (const c of contactIds) {
    activityByContact.set(c, { last_90d_count: 0, last_30d_count: 0, most_recent_at: null, most_recent_type: null });
  }
  for (const a of (activitiesRes.data ?? [])) {
    const s = activityByContact.get(a.contact_id);
    if (!s) continue;
    s.last_90d_count += 1;
    const ts = new Date(a.activity_date).getTime();
    if (now - ts <= 30 * 86400_000) s.last_30d_count += 1;
    if (!s.most_recent_at || ts > new Date(s.most_recent_at).getTime()) {
      s.most_recent_at = a.activity_date;
      s.most_recent_type = a.activity_type;
    }
  }

  const oppByContact = new Map<UUID, OpportunityRow>();
  // Prefer the most-progressed active opportunity per contact
  const stagePriority: Record<string, number> = {
    under_contract: 10, offer_submitted: 9, offer_received: 9,
    listed_active: 8, showing: 7, listing_appt: 7, active_search: 6,
    pre_listing: 5, nurturing: 3, new_lead: 2, active: 7, contacted: 5, referral_received: 3,
  };
  for (const o of (opportunitiesRes.data ?? [])) {
    const existing = oppByContact.get(o.contact_id);
    if (!existing || (stagePriority[o.stage] ?? 0) > (stagePriority[existing.stage] ?? 0)) {
      oppByContact.set(o.contact_id, o as OpportunityRow);
    }
  }

  const marketByZip = new Map<string, MarketPulse>();
  for (const m of (marketRes.data ?? [])) {
    marketByZip.set(m.zip_code, {
      zip: m.zip_code,
      median_price: m.median_sale_price,
      inventory_trend: null, // not in this table; could be filled from a trend table later
      dom: m.median_dom,
    });
  }

  // ── Compute mechanical scores per contact ──────────────────────────────────
  const mechanical = contacts.map(c => {
    const activity = activityByContact.get(c.id)!;
    const daysSince = c.last_activity_date
      ? Math.floor((now - new Date(c.last_activity_date).getTime()) / 86400_000)
      : null;

    const opp = oppByContact.get(c.id) ?? null;

    return {
      contact: c as ContactRow,
      activity,
      daysSince,
      opp,
      relationship: relationshipScore(daysSince, activity.last_30d_count, activity.last_90d_count, c.category),
      pipeline: pipelineScore(opp),
      flags: flagsScore(c as ContactRow),
    };
  });

  // ── Grok intent scoring (batched) ──────────────────────────────────────────
  const BATCH_SIZE = 20;
  const intentByContact = new Map<UUID, IntentResult>();
  const startAi = Date.now();
  let aiFailures = 0;

  const grokInputs: GrokIntentInput[] = mechanical.map(m => ({
    contact_id: m.contact.id,
    category: m.contact.category,
    zip: m.contact.zip_code,
    life_event: m.contact.life_event,
    engagement: {
      last_30d: m.activity.last_30d_count,
      last_90d: m.activity.last_90d_count,
      most_recent_type: m.activity.most_recent_type,
      most_recent_days_ago: m.daysSince,
    },
    market: m.contact.zip_code ? (marketByZip.get(m.contact.zip_code) ?? null) : null,
    active_opportunity: m.opp ? {
      stage: m.opp.stage,
      days_in_stage: m.opp.days_in_current_stage,
      probability: m.opp.ai_deal_probability,
      deal_value: m.opp.deal_value,
    } : null,
  }));

  for (let i = 0; i < grokInputs.length; i += BATCH_SIZE) {
    const batch = grokInputs.slice(i, i + BATCH_SIZE);
    try {
      const results = await scoreIntentBatch(xaiKey, model, batch);
      for (const r of results) intentByContact.set(r.contact_id, r);
    } catch (e) {
      aiFailures += batch.length;
      console.error('Grok batch failed', (e as Error).message);
      // Graceful fallback: neutral intent score, flag in reasoning
      for (const b of batch) {
        intentByContact.set(b.contact_id, {
          contact_id: b.contact_id,
          intent_score: 40,
          reasoning: 'AI intent unavailable; using mechanical score only.',
          key_signals: [],
        });
      }
    }
  }

  const aiMs = Date.now() - startAi;

  // ── Blend + upsert ─────────────────────────────────────────────────────────
  const upsertRows = mechanical.map(m => {
    const intent = intentByContact.get(m.contact.id) ?? {
      contact_id: m.contact.id, intent_score: 40, reasoning: '', key_signals: [],
    };

    const { score, weighted } = blend({
      relationship: m.relationship,
      pipeline: m.pipeline,
      intent: intent.intent_score,
      flags: m.flags,
    });

    // Pick the headline reasoning. Grok's sentence wins if it's concrete; otherwise
    // synthesize a short mechanical one.
    let headline = intent.reasoning;
    if (!headline || headline.includes('unavailable')) {
      if (m.opp && m.pipeline && m.pipeline >= 70) {
        headline = `Active deal in ${m.opp.stage.replace(/_/g, ' ')}, momentum strong.`;
      } else if (m.daysSince !== null && m.relationship < 40) {
        headline = `Overdue touch — last activity ${m.daysSince} days ago.`;
      } else if (m.flags >= 60) {
        headline = `Flagged: pre-approved or VIP.`;
      } else {
        headline = `Steady-state sphere contact.`;
      }
    }

    return {
      id: m.contact.id,
      priority_score: score,
      priority_reasoning: headline,
      priority_components: weighted,
      priority_signals: {
        days_since_last_activity: m.daysSince,
        activity_30d: m.activity.last_30d_count,
        activity_90d: m.activity.last_90d_count,
        active_opportunity_stage: m.opp?.stage ?? null,
        days_in_stage: m.opp?.days_in_current_stage ?? null,
        market_zip: m.contact.zip_code,
        life_event: m.contact.life_event,
        ai_key_signals: intent.key_signals,
      },
      priority_computed_at: new Date().toISOString(),
      priority_model: model,
    };
  });

  // Update in parallel batches. We use .update() (not .upsert()) because PostgREST's
  // upsert sends an INSERT first, which trips NOT NULL constraints on columns we don't
  // provide (e.g. agent_id). Every row here already exists — pure UPDATE is correct.
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
    ai_failures: aiFailures,
    ai_batch_size: BATCH_SIZE,
    ai_ms: aiMs,
    model,
  });
});
