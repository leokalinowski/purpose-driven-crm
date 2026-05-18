/**
 * compute-priority-scores — set-based priority classifier (v6, 2026-05-18 evening).
 *
 * A contact is a PRIORITY if and only if at least one of:
 *
 *   1. PIPELINE — has an active opportunity at one of the EARLY stages
 *      (conversation_active, opportunity_identified, consultation_completed).
 *      Later stages (client_secured, active_opportunity, under_contract) are
 *      NOT priorities — the client is already engaged at that point, so they
 *      don't need to be surfaced as "needs attention."
 *
 *   2. CADENCE — contacts.category is in THIS week's call rotation
 *      (SPHERESYNC_CALLS) or text rotation (SPHERESYNC_TEXTS). This week only —
 *      no overdue carryover from last week.
 *
 * NO weighted score. NO engagement set. NO freshness curve. The previous
 * 0–100 blended score confused more than it helped — Pam's instruction was
 * "Pipeline + Cadence", not "blend everything into a number."
 *
 * What's stored on the contact:
 *   priority_band         text  — 'pipeline' | 'cadence' | NULL (not a priority)
 *   priority_reasoning    text  — one-line plain-English reason
 *   priority_signals      jsonb — { in_pipeline, in_cadence, stage, days_in_stage, rotation_letter, rotation_week, rotation_kind }
 *   priority_computed_at  ts    — when the classifier last ran
 *   priority_model        text  — 'set-based-v6' (model marker)
 *
 *   priority_score        smallint — DEPRECATED. Kept on the row so old reads
 *                                    don't crash; written as NULL by this model.
 *   priority_components   jsonb    — DEPRECATED. Set to {} by this model.
 *
 * When a contact is in BOTH sets, priority_band is 'pipeline' (pipeline
 * outranks cadence). The reasoning sentence mentions both.
 *
 * Invocation
 *   POST /functions/v1/compute-priority-scores
 *     {}                          ← cron (all agents, all contacts)
 *     { agent_id }                ← one agent's full sphere
 *     { contact_ids: [uuid,...] } ← event-driven recompute
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

type UUID = string;
type PriorityBand = 'pipeline' | 'cadence' | null;

interface ContactRow {
  id: UUID; agent_id: UUID;
  first_name: string | null; last_name: string | null;
  category: string | null;
}

interface OpportunityRow {
  id: UUID; contact_id: UUID; stage: string;
  outcome: string | null; days_in_current_stage: number | null;
}

// ─── SphereSync rotation (kept in sync with src/utils/sphereSyncLogic.ts) ────
const SPHERESYNC_CALLS: Record<number, string[]> = {
  1:['S','Q'],2:['M','X'],3:['B','Y'],4:['C','Z'],5:['H','U'],6:['W','E'],7:['L','I'],8:['R','O'],9:['T','V'],10:['P','J'],
  11:['A','K'],12:['D','N'],13:['F','G'],14:['S','X'],15:['M','Y'],16:['B','Z'],17:['C','U'],18:['H','E'],19:['W','I'],20:['L','O'],
  21:['R','V'],22:['T','J'],23:['P','K'],24:['A','N'],25:['D','G'],26:['F','Q'],27:['S','Y'],28:['M','Z'],29:['B','U'],30:['C','E'],
  31:['H','I'],32:['W','O'],33:['L','V'],34:['R','J'],35:['T','K'],36:['P','N'],37:['A','G'],38:['D','Q'],39:['F','X'],40:['S','Z'],
  41:['M','U'],42:['B','E'],43:['C','I'],44:['H','O'],45:['W','V'],46:['L','J'],47:['R','K'],48:['T','N'],49:['P','G'],50:['A','Q'],
  51:['D','X'],52:['F','Y'],
};
const SPHERESYNC_TEXTS: Record<number, string> = {
  1:'M',2:'B',3:'C',4:'H',5:'W',6:'L',7:'R',8:'T',9:'P',10:'A',11:'D',12:'F',13:'G',14:'S',15:'K',16:'N',17:'V',18:'J',19:'E',20:'I',
  21:'O',22:'U',23:'M',24:'B',25:'C',26:'H',27:'W',28:'L',29:'R',30:'T',31:'P',32:'A',33:'D',34:'F',35:'G',36:'S',37:'K',38:'N',39:'V',
  40:'J',41:'E',42:'I',43:'O',44:'U',45:'Q',46:'X',47:'Y',48:'Z',49:'M',50:'B',51:'C',52:'H',
};

// Pam's 7 stages — only the FIRST THREE count as pipeline priorities. After
// `client_secured` the agent has the deal; they're not going to forget about
// it. The pipeline set is intentionally narrow.
const PIPELINE_PRIORITY_STAGES = new Set([
  'conversation_active',
  'opportunity_identified',
  'consultation_completed',
]);

// Order within the pipeline band — earliest stage first (the agent forgets
// the conversation_active contact, not the consultation_completed one).
const STAGE_ORDER: Record<string, number> = {
  conversation_active:    1,
  opportunity_identified: 2,
  consultation_completed: 3,
};

function isoWeek(date: Date): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { week: Math.min(week, 52), year: d.getUTCFullYear() };
}

function rotationFor(week: number): {
  call: Set<string>; text: string; all: Set<string>;
} {
  const callArr = SPHERESYNC_CALLS[week] ?? [];
  const text = (SPHERESYNC_TEXTS[week] ?? '').toUpperCase();
  const call = new Set(callArr.map((c) => c.toUpperCase()));
  const all = new Set([...call, text].filter(Boolean));
  return { call, text, all };
}

function humanStage(stage: string): string {
  const labels: Record<string, string> = {
    conversation_active:    'Conversation active',
    opportunity_identified: 'Opportunity identified',
    consultation_completed: 'Consultation completed',
    client_secured:         'Client secured',
    active_opportunity:     'Active opportunity',
    under_contract:         'Under contract',
  };
  return labels[stage] ?? stage.replace(/_/g, ' ');
}

function buildReasoning(args: {
  inPipeline: boolean;
  inCadence: boolean;
  pipelineStage: string | null;
  rotationLetter: string | null;
  rotationKind: 'call' | 'text' | null;
  currentWeek: number;
}): string {
  const { inPipeline, inCadence, pipelineStage, rotationLetter, rotationKind, currentWeek } = args;
  const parts: string[] = [];
  if (inPipeline && pipelineStage) {
    parts.push(`${humanStage(pipelineStage)} in your pipeline`);
  }
  if (inCadence && rotationLetter) {
    parts.push(`Week ${currentWeek} ${rotationKind === 'text' ? 'text' : 'call'} rotation (letter ${rotationLetter})`);
  }
  if (parts.length === 0) return '';
  return parts.join(' · ');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseServiceKey) return json({ error: 'Missing Supabase env' }, 500);

  // Auth — cron or user bearer. Same model as before.
  const isCron = req.headers.get('X-Cron-Job') === 'true' || req.headers.get('source') === 'pg_cron';
  let callerAgentId: UUID | null = null;
  let callerIsAdmin = false;
  if (!isCron) {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Auth required' }, 401);
    const userClient = createClient(supabaseUrl, supabaseServiceKey, { global: { headers: { Authorization: authHeader } } });
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

  if (!isCron && !callerIsAdmin && targetAgentId && targetAgentId !== callerAgentId) {
    return json({ error: 'Agents can only score their own contacts' }, 403);
  }

  // Pull contacts. We only need id + agent + name + category.
  let contactsQuery = supabase.from('contacts')
    .select('id, agent_id, first_name, last_name, category');
  if (targetContactIds && targetContactIds.length > 0) contactsQuery = contactsQuery.in('id', targetContactIds);
  else if (targetAgentId) contactsQuery = contactsQuery.eq('agent_id', targetAgentId);
  else if (!isCron && !callerIsAdmin) contactsQuery = contactsQuery.eq('agent_id', callerAgentId!);

  const { data: contacts, error: contactsErr } = await contactsQuery;
  if (contactsErr) return json({ error: contactsErr.message }, 500);
  if (!contacts || contacts.length === 0) return json({ scored: 0 });

  const contactIds = contacts.map((c) => c.id);
  const now = new Date();
  const { week: curWeek } = isoWeek(now);
  const curRotation = rotationFor(curWeek);

  // Active opportunities — stage IS NOT NULL AND stage NOT IN (closed, lost).
  // We further filter to the EARLY-stage set in code (PIPELINE_PRIORITY_STAGES)
  // because client_secured / active_opportunity / under_contract are committed
  // clients, not priorities to surface.
  const { data: oppData, error: oppErr } = await supabase.from('opportunities')
    .select('id, contact_id, stage, outcome, days_in_current_stage')
    .in('contact_id', contactIds)
    .not('stage', 'is', null)
    .not('stage', 'in', '(closed,lost)');
  if (oppErr) return json({ error: 'opportunities: ' + oppErr.message }, 500);

  // Pick the most-progressed PRIORITY-stage opp per contact. Opps in later
  // stages (client_secured+) are ignored entirely.
  const oppByContact = new Map<UUID, OpportunityRow>();
  for (const o of (oppData ?? []) as OpportunityRow[]) {
    if (o.outcome === 'lost' || o.outcome === 'withdrawn') continue;
    if (!PIPELINE_PRIORITY_STAGES.has(o.stage)) continue;
    const existing = oppByContact.get(o.contact_id);
    if (!existing || (STAGE_ORDER[o.stage] ?? 0) > (STAGE_ORDER[existing.stage] ?? 0)) {
      oppByContact.set(o.contact_id, o);
    }
  }

  // Classify each contact.
  const upsertRows = contacts.map((cRaw) => {
    const c = cRaw as ContactRow;
    const letter = (c.category ?? '').toUpperCase();
    const opp = oppByContact.get(c.id) ?? null;

    const inPipeline = !!opp;
    const inCadence = !!letter && curRotation.all.has(letter);
    const rotationKind: 'call' | 'text' | null = inCadence
      ? (letter === curRotation.text ? 'text' : 'call')
      : null;

    // Pipeline outranks cadence when both apply.
    const band: PriorityBand = inPipeline ? 'pipeline' : inCadence ? 'cadence' : null;

    const reasoning = buildReasoning({
      inPipeline, inCadence,
      pipelineStage: opp?.stage ?? null,
      rotationLetter: inCadence ? letter : null,
      rotationKind,
      currentWeek: curWeek,
    });

    return {
      id: c.id,
      priority_band: band,
      priority_reasoning: reasoning,
      priority_score: null,            // deprecated; clear the old value
      priority_components: {},         // deprecated; clear the old breakdown
      priority_signals: {
        in_pipeline: inPipeline,
        in_cadence: inCadence,
        pipeline_stage: opp?.stage ?? null,
        days_in_stage: opp?.days_in_current_stage ?? null,
        rotation_week: curWeek,
        rotation_letter: inCadence ? letter : null,
        rotation_kind: rotationKind,
      },
      priority_computed_at: new Date().toISOString(),
      priority_model: 'set-based-v6',
    };
  });

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

  const classified = upsertRows.reduce((acc, r) => {
    if (r.priority_band === 'pipeline')      acc.pipeline += 1;
    else if (r.priority_band === 'cadence')  acc.cadence  += 1;
    else                                     acc.none     += 1;
    return acc;
  }, { pipeline: 0, cadence: 0, none: 0 });

  return json({
    classified: contacts.length,
    breakdown: classified,
    rotation_week: curWeek,
    rotation_call: Array.from(curRotation.call),
    rotation_text: curRotation.text,
    model: 'set-based-v6',
  });
});
