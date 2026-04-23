/**
 * generate-agent-intelligence
 *
 * Runs daily (pg_cron 06:00 UTC) for every agent.
 * Gathers relationship, pipeline, market, and coaching data,
 * synthesises it with Claude, and upserts one snapshot per
 * agent per ISO week into agent_intelligence_snapshots.
 *
 * Manual trigger (admin only):
 *   POST /functions/v1/generate-agent-intelligence
 *   { "agent_id": "<uuid>" }   ← optional, omit for all agents
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';
import { corsHeaders } from '../_shared/cors.ts';
import { getCurrentWeekTasks } from '../_shared/spheresync-config.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  // ── Env ───────────────────────────────────────────────────────────────────
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');

  if (!supabaseUrl || !supabaseServiceKey) return json({ error: 'Missing Supabase env vars' }, 500);
  if (!anthropicKey) return json({ error: 'ANTHROPIC_API_KEY not configured' }, 500);

  // ── Auth ──────────────────────────────────────────────────────────────────
  const isCronJob =
    req.headers.get('X-Cron-Job') === 'true' ||
    req.headers.get('source') === 'pg_cron';
  const authHeader = req.headers.get('Authorization');

  if (!isCronJob) {
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Authentication required' }, 401);

    const { data: userRole } = await createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    }).rpc('get_current_user_role');

    if (userRole !== 'admin') return json({ error: 'Admin access required' }, 403);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const body = await req.json().catch(() => ({}));
  const { agent_id: targetAgentId = null } = body;

  // ── Resolve agents ────────────────────────────────────────────────────────
  type AgentRow = { user_id: string; first_name: string; last_name: string };
  let agents: AgentRow[] = [];

  if (targetAgentId) {
    const { data } = await supabase
      .from('profiles')
      .select('user_id, first_name, last_name')
      .eq('user_id', targetAgentId)
      .single();
    if (data) agents = [data as AgentRow];
  } else {
    const { data: roles } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', ['agent', 'admin']);
    const ids = (roles ?? []).map((r: { user_id: string }) => r.user_id);
    const { data } = await supabase
      .from('profiles')
      .select('user_id, first_name, last_name')
      .in('user_id', ids);
    agents = (data ?? []) as AgentRow[];
  }

  const currentWeek = getCurrentWeekTasks();
  const today = new Date().toISOString().split('T')[0];
  const now = Date.now();
  const results: Array<{ agent_id: string; status: string; error?: string }> = [];

  for (const agent of agents) {
    try {
      // ── Gather data in parallel ─────────────────────────────────────────
      const [
        contactsRes,
        activitiesRes,
        emailLogsRes,
        opportunitiesRes,
        coachingRes,
        sphereTasksRes,
      ] = await Promise.all([
        supabase
          .from('contacts')
          .select('id, first_name, last_name, email, category, last_activity_date, activity_count, zip_code')
          .eq('agent_id', agent.user_id),

        supabase
          .from('contact_activities')
          .select('contact_id, activity_type, activity_date, outcome')
          .eq('agent_id', agent.user_id)
          .gte('activity_date', new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()),

        supabase
          .from('email_logs')
          .select('recipient_email, status')
          .eq('agent_id', agent.user_id)
          .gte('created_at', new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString())
          .in('status', ['opened', 'clicked']),

        supabase
          .from('opportunities')
          .select('id, contact_id, stage, deal_value, expected_close_date, updated_at, opportunity_type, ai_deal_probability, ai_suggested_next_action')
          .eq('agent_id', agent.user_id)
          .is('actual_close_date', null)
          .not('outcome', 'in', '(lost,withdrawn)'),

        supabase
          .from('coaching_submissions')
          .select('week_number, year, dials_made, leads_contacted, conversations, deals_closed, appointments_set, database_size')
          .eq('agent_id', agent.user_id)
          .order('year', { ascending: false })
          .order('week_number', { ascending: false })
          .limit(4),

        supabase
          .from('spheresync_tasks')
          .select('id, task_type, completed, lead_id')
          .eq('agent_id', agent.user_id)
          .eq('week_number', currentWeek.weekNumber)
          .eq('year', currentWeek.isoYear),
      ]);

      const contacts = (contactsRes.data ?? []) as Array<{
        id: string; first_name?: string; last_name: string; email?: string;
        category: string; last_activity_date?: string; activity_count?: number; zip_code?: string;
      }>;
      const activities = activitiesRes.data ?? [];
      const emailLogs = emailLogsRes.data ?? [];
      const opportunities = (opportunitiesRes.data ?? []) as Array<{
        id: string; stage: string; deal_value: number; updated_at: string;
        opportunity_type?: string; ai_deal_probability?: number | null; ai_suggested_next_action?: string | null;
      }>;
      const coaching = coachingRes.data ?? [];
      const sphereTasks = sphereTasksRes.data ?? [];

      // ── Compute sphere health stats ────────────────────────────────────
      const neverTouched = contacts.filter(c => !c.last_activity_date).length;
      const overdue30 = contacts.filter(c =>
        !c.last_activity_date || (now - new Date(c.last_activity_date).getTime()) > 30 * 86400000
      ).length;
      const overdue90 = contacts.filter(c =>
        !c.last_activity_date || (now - new Date(c.last_activity_date).getTime()) > 90 * 86400000
      ).length;

      const touched = contacts.filter(c => !!c.last_activity_date);
      const avgDaysSince = touched.length > 0
        ? Math.round(touched.reduce((s, c) => s + (now - new Date(c.last_activity_date!).getTime()) / 86400000, 0) / touched.length)
        : null;

      const healthScore = contacts.length === 0 ? 0
        : Math.max(0, Math.round(100 - (overdue90 / contacts.length * 50) - (overdue30 / contacts.length * 30)));

      // ── Email engagement map ───────────────────────────────────────────
      const emailEngMap = new Map<string, { opens: number; clicks: number }>();
      for (const log of emailLogs) {
        const key = (log.recipient_email ?? '').toLowerCase();
        if (!key) continue;
        const e = emailEngMap.get(key) ?? { opens: 0, clicks: 0 };
        if (log.status === 'opened') e.opens++;
        else if (log.status === 'clicked') e.clicks++;
        emailEngMap.set(key, e);
      }

      // Top 5 engaged contacts
      const engagedContacts = contacts
        .map(c => {
          const e = emailEngMap.get((c.email ?? '').toLowerCase()) ?? { opens: 0, clicks: 0 };
          return { name: `${c.first_name ?? ''} ${c.last_name}`.trim(), opens: e.opens, clicks: e.clicks };
        })
        .filter(c => c.opens + c.clicks > 0)
        .sort((a, b) => (b.opens + b.clicks * 2) - (a.opens + a.clicks * 2))
        .slice(0, 5);

      // ── Contacts in scope this week ────────────────────────────────────
      const inScope = contacts
        .filter(c => currentWeek.callCategories.includes(c.category) || c.category === currentWeek.textCategory)
        .slice(0, 15)
        .map(c => ({
          name: `${c.first_name ?? ''} ${c.last_name}`.trim(),
          task_type: currentWeek.callCategories.includes(c.category) ? 'call' : 'text',
          days_since_touch: c.last_activity_date
            ? Math.floor((now - new Date(c.last_activity_date).getTime()) / 86400000)
            : null,
        }));

      // ── Market stats for agent's top zip codes ─────────────────────────
      const zipCodes = [...new Set(contacts.map(c => c.zip_code).filter(Boolean))].slice(0, 5) as string[];
      let marketStats: Array<{ zip_code: string; period_month: string; median_sale_price: number; inventory: number; median_dom: number }> = [];

      if (zipCodes.length > 0) {
        const { data: mktData } = await supabase
          .from('market_stats')
          .select('zip_code, period_month, median_sale_price, inventory, median_dom')
          .in('zip_code', zipCodes)
          .order('period_month', { ascending: false })
          .limit(zipCodes.length * 2);

        const latestPerZip = new Map<string, typeof marketStats[number]>();
        for (const stat of mktData ?? []) {
          if (!latestPerZip.has(stat.zip_code)) latestPerZip.set(stat.zip_code, stat);
        }
        marketStats = Array.from(latestPerZip.values());
      }

      // ── SphereSync progress ────────────────────────────────────────────
      const completedTasks = sphereTasks.filter((t: { completed: boolean }) => t.completed).length;
      const totalTasks = sphereTasks.length;

      // ── Pipeline context ───────────────────────────────────────────────
      const pipelineContext = opportunities.slice(0, 8).map(o => ({
        stage: o.stage,
        opportunity_type: o.opportunity_type ?? 'buyer',
        deal_value: o.deal_value,
        ai_deal_probability: o.ai_deal_probability ?? null,
        ai_suggested_next_action: o.ai_suggested_next_action ?? null,
        days_since_update: Math.floor((now - new Date(o.updated_at).getTime()) / 86400000),
      }));

      // ── Build Claude prompt ────────────────────────────────────────────
      const agentName = `${agent.first_name} ${agent.last_name}`;

      const systemPrompt = `You are an AI business intelligence assistant for a real estate agent CRM called REOP Hub.
Today is ${today}, ISO week ${currentWeek.weekNumber} of ${currentWeek.isoYear}.

Generate a structured weekly intelligence snapshot for ${agentName}. Be concise, specific, and data-driven. Every observation must reference an actual number from the data provided. Avoid generic real estate advice.

Return ONLY a valid JSON object with exactly these five keys:
- sphere_health: { health_score (0-100 integer), summary (1-2 sentences about overall relationship health), key_stat (most urgent single fact, e.g. "47 contacts haven't been touched in 90+ days") }
- top_opportunities: array of up to 3 objects: { contact_name (use "Unknown" if no name), stage, opportunity_type, deal_value, deal_probability (integer 0-100 if available from ai_deal_probability, else null), days_since_update, next_action (1 specific AI-suggested action, max 12 words — if ai_suggested_next_action is set use it verbatim, otherwise generate one) }
- market_pulse: { summary (1-2 sentences citing specific stats like price or inventory), key_stats: array of { zip, median_price, trend ("up"/"down"/"flat") } }
- weekly_priorities: array of up to 5 objects: { contact_name, task_type ("call" or "text"), priority_rank (1-5, 1=highest), reason (max 15 words, factual), talking_points (array of 2 short strings, each max 12 words) }
- coaching_context: { week_trend ("improving"/"declining"/"steady"), observation (1 sentence citing specific numbers from coaching data) }

No markdown, no explanation outside the JSON.`;

      const userMsg = `Agent: ${agentName}

SPHERE HEALTH:
Total contacts: ${contacts.length}
Never touched: ${neverTouched}
Not touched in 30+ days: ${overdue30}
Not touched in 90+ days: ${overdue90}
Avg days since last touch: ${avgDaysSince ?? 'N/A'}

EMAIL ENGAGEMENT (last 90 days):
${engagedContacts.length > 0 ? JSON.stringify(engagedContacts) : 'No email engagement data'}

PIPELINE (open opportunities — includes AI scoring where available):
Total open: ${opportunities.length}
Scored by AI: ${opportunities.filter(o => o.ai_deal_probability != null).length}
${pipelineContext.length > 0 ? JSON.stringify(pipelineContext, null, 2) : 'No open opportunities'}

MARKET DATA:
${marketStats.length > 0 ? JSON.stringify(marketStats.map(m => ({ zip: m.zip_code, period: m.period_month, median_price: m.median_sale_price, inventory: m.inventory, dom: m.median_dom }))) : 'No market data for this agent\'s zip codes'}

COACHING (last 4 weeks, most recent first):
${coaching.length > 0 ? JSON.stringify(coaching) : 'No coaching submissions found'}

SPHERESYNC THIS WEEK (Week ${currentWeek.weekNumber}):
Call categories: ${currentWeek.callCategories.join(', ')}
Text category: ${currentWeek.textCategory}
Contacts in scope: ${JSON.stringify(inScope)}
Tasks completed: ${completedTasks} of ${totalTasks}

Generate the intelligence snapshot now.`;

      // ── Call Claude ────────────────────────────────────────────────────
      const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 2000,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMsg }],
        }),
      });

      if (!claudeResp.ok) {
        throw new Error(`Anthropic API error: ${claudeResp.status} ${await claudeResp.text()}`);
      }

      const claudeData = await claudeResp.json();
      const rawText: string = claudeData?.content?.[0]?.text ?? '';

      let snapshot: Record<string, unknown>;
      try {
        snapshot = JSON.parse(rawText);
      } catch {
        const match = rawText.match(/\{[\s\S]*\}/);
        if (!match) throw new Error('Could not extract JSON from Claude response');
        snapshot = JSON.parse(match[0]);
      }

      // ── Upsert snapshot ────────────────────────────────────────────────
      const { error: upsertError } = await supabase
        .from('agent_intelligence_snapshots')
        .upsert(
          {
            agent_id: agent.user_id,
            week_number: currentWeek.weekNumber,
            year: currentWeek.isoYear,
            generated_at: new Date().toISOString(),
            sphere_health: snapshot.sphere_health ?? {},
            top_opportunities: snapshot.top_opportunities ?? [],
            market_pulse: snapshot.market_pulse ?? {},
            weekly_priorities: snapshot.weekly_priorities ?? [],
            coaching_context: snapshot.coaching_context ?? {},
            model_version: 'claude-3-5-sonnet-20241022',
            raw_prompt_tokens: claudeData.usage?.input_tokens ?? null,
            raw_completion_tokens: claudeData.usage?.output_tokens ?? null,
          },
          { onConflict: 'agent_id,week_number,year' }
        );

      if (upsertError) throw upsertError;

      console.log(`Intelligence snapshot saved for agent ${agent.user_id} (week ${currentWeek.weekNumber}/${currentWeek.isoYear})`);
      results.push({ agent_id: agent.user_id, status: 'success' });

    } catch (err: any) {
      console.error(`Intelligence generation failed for agent ${agent.user_id}:`, err.message);
      results.push({ agent_id: agent.user_id, status: 'error', error: err.message });
    }
  }

  const succeeded = results.filter(r => r.status === 'success').length;
  const failed = results.filter(r => r.status === 'error').length;

  return json({
    success: true,
    week_number: currentWeek.weekNumber,
    year: currentWeek.isoYear,
    agents_total: agents.length,
    agents_succeeded: succeeded,
    agents_failed: failed,
    results,
  });
});
