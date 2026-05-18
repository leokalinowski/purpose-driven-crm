/**
 * delight-daily-nudge — cron-triggered.
 *
 * For every agent, finds upcoming Delight opportunities and drops a Coach
 * task into `agent_action_items` at three trigger points:
 *   - 7 days before the occasion
 *   - 1 day before the occasion
 *   - the day of the occasion
 *
 * Idempotent: skips creating a task if one already exists for the same
 * (agent, contact, kind, occurrence-date, trigger-window). The task's
 * description includes the occasion + any saved gift_preferences. The
 * action_url deeplinks straight into /delight so the agent can act.
 *
 * Auth: cron-bypass via X-Cron-Job: true header, or service-role JWT.
 */

import { corsHeaders } from '../_shared/cors.ts';
import { requireCronAuth } from '../_shared/authGuards.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

interface OpportunityRow {
  agent_id: string;
  contact_id: string;
  first_name: string | null;
  last_name: string | null;
  kind: 'birthday' | 'spouse_birthday' | 'home_anniversary';
  source_date: string;
  next_occurrence: string;
  days_away: number;
  gift_preferences: string | null;
  last_gift_sent_at: string | null;
}

const KIND_LABEL: Record<OpportunityRow['kind'], string> = {
  birthday: 'birthday',
  spouse_birthday: 'spouse\'s birthday',
  home_anniversary: 'home anniversary',
};

const KIND_EMOJI: Record<OpportunityRow['kind'], string> = {
  birthday: '🎂',
  spouse_birthday: '🎂',
  home_anniversary: '🏡',
};

// Trigger windows (days_away values that should fire).
const TRIGGER_DAYS: Array<{ days: number; tag: 'week' | 'tomorrow' | 'today' }> = [
  { days: 7, tag: 'week' },
  { days: 1, tag: 'tomorrow' },
  { days: 0, tag: 'today' },
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function buildTitle(opp: OpportunityRow, tag: 'week' | 'tomorrow' | 'today'): string {
  const name = [opp.first_name, opp.last_name].filter(Boolean).join(' ') || 'a contact';
  const occasion = KIND_LABEL[opp.kind];
  const emoji = KIND_EMOJI[opp.kind];
  if (tag === 'today') return `${emoji} ${name}'s ${occasion} is TODAY`;
  if (tag === 'tomorrow') return `${emoji} ${name}'s ${occasion} is tomorrow`;
  return `${emoji} ${name}'s ${occasion} in 7 days`;
}

function buildDescription(opp: OpportunityRow): string {
  const bits: string[] = [];
  if (opp.gift_preferences) bits.push(`Likes: ${opp.gift_preferences}`);
  if (opp.last_gift_sent_at) {
    bits.push(`Last gifted: ${new Date(opp.last_gift_sent_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`);
  }
  bits.push('Tap to log a gift or skip this year.');
  return bits.join(' · ');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // SECURITY (hardened 2026-05-18): require cron-secret header OR
  // legacy X-Cron-Job header when CRON_SHARED_SECRET env is unset.
  // Replaces the prior bearer-token-equality check (still safe but
  // moves the secret to its own env var so we don't conflate cron
  // auth with service-role auth).
  const denied = requireCronAuth(req);
  if (denied) return denied;

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const summary: Array<{ agent_id: string; created: number; skipped: number }> = [];
  let totalCreated = 0;
  let totalSkipped = 0;

  // Pull every opportunity within the largest trigger window we care about.
  // The view returns next_occurrence + days_away already.
  const triggerDaysSet = new Set(TRIGGER_DAYS.map((t) => t.days));
  const { data: opps, error: oppsErr } = await supabase
    .from('delight_opportunities_v')
    .select('*')
    .lte('days_away', 7)
    .gte('days_away', 0);
  if (oppsErr) {
    console.error('[delight-daily-nudge] query failed:', oppsErr);
    return jsonResponse({ ok: false, error: oppsErr.message }, 500);
  }

  // Filter to only the days we trigger on.
  const candidates = (opps ?? []).filter((o: OpportunityRow) => triggerDaysSet.has(o.days_away)) as OpportunityRow[];

  // Group by agent for the summary report.
  const byAgent = new Map<string, OpportunityRow[]>();
  for (const o of candidates) {
    if (!byAgent.has(o.agent_id)) byAgent.set(o.agent_id, []);
    byAgent.get(o.agent_id)!.push(o);
  }

  for (const [agentId, list] of byAgent) {
    let created = 0;
    let skipped = 0;
    for (const opp of list) {
      const tag = TRIGGER_DAYS.find((t) => t.days === opp.days_away)!.tag;

      // Idempotency: bake the trigger context into action_url so we can
      // detect duplicate (agent, contact, kind, occurrence, tag).
      const actionUrl = `/delight?nudge=${encodeURIComponent(`${opp.contact_id}:${opp.kind}:${opp.next_occurrence}:${tag}`)}`;

      const { count, error: existsErr } = await supabase
        .from('agent_action_items')
        .select('id', { count: 'exact', head: true })
        .eq('agent_id', agentId)
        .eq('item_type', 'delight_nudge')
        .eq('action_url', actionUrl);
      if (existsErr) {
        console.error('[delight-daily-nudge] dedup check failed:', existsErr);
        continue;
      }
      if ((count ?? 0) > 0) {
        skipped++;
        continue;
      }

      const { error: insertErr } = await supabase.from('agent_action_items').insert({
        agent_id: agentId,
        item_type: 'delight_nudge',
        title: buildTitle(opp, tag),
        description: buildDescription(opp),
        action_url: actionUrl,
        priority: tag === 'today' ? 'high' : tag === 'tomorrow' ? 'medium' : 'low',
      });
      if (insertErr) {
        console.error('[delight-daily-nudge] insert failed:', insertErr);
        continue;
      }
      created++;
    }
    summary.push({ agent_id: agentId, created, skipped });
    totalCreated += created;
    totalSkipped += skipped;
  }

  return jsonResponse({
    ok: true,
    candidates: candidates.length,
    created: totalCreated,
    skipped: totalSkipped,
    by_agent: summary,
  });
});
