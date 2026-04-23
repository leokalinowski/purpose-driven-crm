/**
 * pipeline-score-opportunities
 *
 * Scores all open opportunities for an agent (or a single opportunity)
 * with Claude. Produces:
 *   - ai_deal_probability  (0–100)
 *   - ai_summary           (2–3 sentence status brief)
 *   - ai_suggested_next_action (one concrete action, max 12 words)
 *   - ai_risk_flags        (string[]: 'stale'|'no_lender'|'price_gap'|'contingency_expiring'|...)
 *
 * Called by:
 *   - pg_cron daily at 07:00 UTC (after generate-agent-intelligence at 06:00)
 *   - Frontend "Refresh AI Scores" button (single opportunity or agent)
 *
 * Auth: pg_cron (X-Cron-Job: true) or admin Bearer token.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';
import { corsHeaders } from './_shared/cors.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');

  if (!supabaseUrl || !supabaseKey) return json({ error: 'Missing Supabase env vars' }, 500);
  if (!anthropicKey) return json({ error: 'ANTHROPIC_API_KEY not configured' }, 500);

  // ── Auth ──────────────────────────────────────────────────────────────────
  const isCron = req.headers.get('X-Cron-Job') === 'true' || req.headers.get('source') === 'pg_cron';
  const authHeader = req.headers.get('Authorization');

  if (!isCron) {
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Authentication required' }, 401);
    const callerClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: role } = await callerClient.rpc('get_current_user_role');
    // Admins: score anyone. Agents: may only score their own deals (agent_id enforced below).
    if (role !== 'admin' && role !== 'agent') return json({ error: 'Authentication required' }, 403);
    // For agents, override targetAgentId to their own user_id so they can't score other agents.
    if (role === 'agent') {
      const { data: { user } } = await callerClient.auth.getUser();
      if (!user) return json({ error: 'Could not resolve user' }, 401);
      // body hasn't been parsed yet — parsed below; store for later override
      (req as any)._agentUserId = user.id;
    }
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const body = await req.json().catch(() => ({}));
  // If an agent triggered this, force agent_id to be their own id (security)
  const agentOverride = (req as any)._agentUserId ?? null;
  const { agent_id: _bodyAgentId = null, opportunity_id: targetOppId = null } = body;
  const targetAgentId: string | null = agentOverride ?? _bodyAgentId;

  // ── Resolve agents ─────────────────────────────────────────────────────��──
  type AgentRow = { user_id: string; first_name: string; last_name: string };
  let agents: AgentRow[] = [];

  if (targetAgentId) {
    const { data } = await supabase.from('profiles').select('user_id, first_name, last_name').eq('user_id', targetAgentId).single();
    if (data) agents = [data as AgentRow];
  } else {
    const { data: roles } = await supabase.from('user_roles').select('user_id').in('role', ['agent', 'admin']);
    const ids = (roles ?? []).map((r: { user_id: string }) => r.user_id);
    const { data } = await supabase.from('profiles').select('user_id, first_name, last_name').in('user_id', ids);
    agents = (data ?? []) as AgentRow[];
  }

  const today = new Date().toISOString().split('T')[0];
  const results: Array<{ agent_id: string; opps_scored: number; status: string; error?: string }> = [];

  for (const agent of agents) {
    try {
      // ── Fetch open opportunities ──────────────────────────────────────────
      let oppsQuery = supabase
        .from('opportunities')
        .select(`
          id, stage, opportunity_type, pipeline_type, title,
          deal_value, list_price, expected_close_date, updated_at, created_at,
          days_in_current_stage, is_stale,
          property_city, property_zip,
          contact_id,
          ai_deal_probability, ai_scored_at,
          contact:contacts(
            first_name, last_name,
            move_timeline, motivation_score,
            buyer_pre_approval_status, buyer_price_min, buyer_price_max,
            buyer_lender_name,
            relationship_strength,
            seller_listing_timeline, seller_estimated_value
          )
        `)
        .eq('agent_id', agent.user_id)
        .is('actual_close_date', null)
        .not('outcome', 'in', '("lost","withdrawn")');

      if (targetOppId) {
        oppsQuery = oppsQuery.eq('id', targetOppId);
      }

      const { data: opps, error: oppsErr } = await oppsQuery;
      if (oppsErr) throw oppsErr;
      if (!opps || opps.length === 0) {
        results.push({ agent_id: agent.user_id, opps_scored: 0, status: 'no_open_opps' });
        continue;
      }

      // ── Gather enrichment data in parallel ────────────────────────────────
      const oppIds = opps.map((o: any) => o.id);
      const [activitiesRes, stageHistRes, tasksRes] = await Promise.all([
        supabase.from('opportunity_activities')
          .select('opportunity_id, activity_type, activity_date, description')
          .in('opportunity_id', oppIds)
          .order('activity_date', { ascending: false })
          .limit(oppIds.length * 5),
        supabase.from('opportunity_stage_history')
          .select('opportunity_id, from_stage, to_stage, changed_at, days_in_from_stage')
          .in('opportunity_id', oppIds)
          .order('changed_at', { ascending: false })
          .limit(oppIds.length * 3),
        supabase.from('pipeline_tasks')
          .select('opportunity_id, completed, due_date, title')
          .in('opportunity_id', oppIds)
          .eq('completed', false),
      ]);

      // Build lookup maps
      const actMap = new Map<string, any[]>();
      for (const a of activitiesRes.data ?? []) {
        const arr = actMap.get(a.opportunity_id) ?? [];
        if (arr.length < 5) { arr.push(a); actMap.set(a.opportunity_id, arr); }
      }
      const histMap = new Map<string, any[]>();
      for (const h of stageHistRes.data ?? []) {
        const arr = histMap.get(h.opportunity_id) ?? [];
        if (arr.length < 3) { arr.push(h); histMap.set(h.opportunity_id, arr); }
      }
      const taskMap = new Map<string, number>();
      for (const t of tasksRes.data ?? []) {
        taskMap.set(t.opportunity_id, (taskMap.get(t.opportunity_id) ?? 0) + 1);
      }
      const overdueTaskMap = new Map<string, number>();
      for (const t of tasksRes.data ?? []) {
        if (t.due_date && t.due_date < today) {
          overdueTaskMap.set(t.opportunity_id, (overdueTaskMap.get(t.opportunity_id) ?? 0) + 1);
        }
      }

      // ── Build Claude context ──────────────────────────────────────────────
      const context = (opps as any[]).map(o => ({
        opportunity_id: o.id,
        title: o.title ? o.title : ((`${o.contact?.first_name ?? ''} ${o.contact?.last_name ?? ''}`).trim() || 'Unnamed'),
        type: o.opportunity_type,
        pipeline: o.pipeline_type ?? 'buyer',
        stage: o.stage,
        days_in_stage: o.days_in_current_stage ?? 0,
        deal_value: o.deal_value,
        list_price: o.list_price,
        expected_close: o.expected_close_date,
        contact: {
          move_timeline: o.contact?.move_timeline,
          motivation_score: o.contact?.motivation_score,
          pre_approval_status: o.contact?.buyer_pre_approval_status,
          price_budget_max: o.contact?.buyer_price_max,
          lender_name: o.contact?.buyer_lender_name,
          relationship_strength: o.contact?.relationship_strength,
          listing_timeline: o.contact?.seller_listing_timeline,
        },
        recent_activities: actMap.get(o.id) ?? [],
        stage_history: histMap.get(o.id) ?? [],
        open_tasks: taskMap.get(o.id) ?? 0,
        overdue_tasks: overdueTaskMap.get(o.id) ?? 0,
        days_since_last_activity: (() => {
          const acts = actMap.get(o.id);
          if (!acts || acts.length === 0) return null;
          const last = new Date(acts[0].activity_date);
          return Math.floor((Date.now() - last.getTime()) / 86400000);
        })(),
      }));

      const systemPrompt = `You are a real estate transaction analyst AI. Today is ${today}.

For each opportunity, analyse the data and return a JSON array where each item has:
- opportunity_id (string, exact match from input)
- deal_probability (integer 0-100)
  Weighting:
  • pre_approval_status = "pre_approved" → +20
  • stage is "under_contract" → base 80+
  • stage is "offer_submitted" → base 65
  • stage is "showing" or "active_search" → base 40-60
  • stage is "nurturing" or "new_lead" → base 10-30
  • days_in_stage > 30 for early stages → -10
  • days_since_last_activity > 14 → -10 (stale signal)
  • overdue_tasks > 0 → -5 per overdue task
  • relationship_strength 4-5 → +5
  • no lender name in active_search or showing → -10
- summary (string, 2-3 sentences, cite specific data like days/prices)
- suggested_next_action (string, ≤12 words, concrete and specific)
- risk_flags (array of strings from: "stale", "no_lender", "price_gap", "overdue_tasks", "contingency_expiring", "no_activity", "needs_qualification")

Return ONLY a valid JSON array. No markdown, no explanation outside the JSON.`;

      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 3000,
          system: systemPrompt,
          messages: [{ role: 'user', content: `Score these ${context.length} opportunities for agent ${agent.first_name} ${agent.last_name}:\n\n${JSON.stringify(context, null, 2)}` }],
        }),
      });

      if (!resp.ok) throw new Error(`Anthropic API ${resp.status}: ${await resp.text()}`);

      const claudeData = await resp.json();
      const raw: string = claudeData?.content?.[0]?.text ?? '';
      let scored: any[];
      try { scored = JSON.parse(raw); }
      catch {
        const m = raw.match(/\[[\s\S]*\]/);
        if (!m) throw new Error('No JSON array in Claude response');
        scored = JSON.parse(m[0]);
      }

      // ── Batch-update opportunities ────────────────────────────────────────
      const scoredAt = new Date().toISOString();
      let updated = 0;
      for (const item of scored) {
        if (!item.opportunity_id) continue;
        const prob = Math.max(0, Math.min(100, Math.round(Number(item.deal_probability) || 50)));
        const isStale = Array.isArray(item.risk_flags) && item.risk_flags.includes('stale');
        const { error: updErr } = await supabase
          .from('opportunities')
          .update({
            ai_deal_probability:      prob,
            ai_summary:               item.summary ?? null,
            ai_suggested_next_action: item.suggested_next_action ?? null,
            ai_risk_flags:            Array.isArray(item.risk_flags) ? item.risk_flags : [],
            ai_scored_at:             scoredAt,
            is_stale:                 isStale,
            stale_since:              isStale ? today : null,
          })
          .eq('id', item.opportunity_id);
        if (updErr) console.warn(`Update failed for ${item.opportunity_id}:`, updErr.message);
        else updated++;
      }

      results.push({ agent_id: agent.user_id, opps_scored: updated, status: 'success' });
    } catch (err: any) {
      console.error(`Scoring failed for agent ${agent.user_id}:`, err.message);
      results.push({ agent_id: agent.user_id, opps_scored: 0, status: 'error', error: err.message });
    }
  }

  return json({
    success: true,
    date: today,
    agents_total: agents.length,
    agents_succeeded: results.filter(r => r.status === 'success').length,
    agents_failed: results.filter(r => r.status === 'error').length,
    results,
  });
});
