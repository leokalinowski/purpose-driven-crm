import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';
import { corsHeaders } from "../_shared/cors.ts";
import { SPHERESYNC_CALLS, SPHERESYNC_TEXTS, getISOWeekNumber, getCurrentWeekTasks } from "../_shared/spheresync-config.ts";

interface Contact {
  id: string;
  first_name?: string;
  last_name: string;
  category: string;
  agent_id: string;
  email?: string;
  last_activity_date?: string;
  activity_count?: number;
}

interface InsertedTask {
  id: string;
  lead_id: string;
  task_type: string;
}

interface ProcessResult {
  agent_id: string;
  agent_name: string;
  contacts_total?: number;
  contacts_call?: number;
  contacts_text?: number;
  tasks_generated?: number;
  call_tasks?: number;
  text_tasks?: number;
  ai_scored?: boolean;
  ai_scoring_error?: string;
  skipped?: boolean;
  skipped_reason?: string;
  error?: string;
}

// ── AI Scoring ──────────────────────────────────────────────────────────────

async function scoreTasksWithAI(
  supabase: ReturnType<typeof createClient>,
  agentId: string,
  insertedTasks: InsertedTask[],
  inScopeContacts: Contact[],
  anthropicKey: string,
  weekNumber: number
): Promise<void> {
  if (insertedTasks.length === 0) return;

  const contactIds = inScopeContacts.map(c => c.id);
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  // Fetch enrichment data in parallel
  const [activitiesResult, emailResult, pipelineResult] = await Promise.all([
    supabase
      .from('contact_activities')
      .select('contact_id, activity_type, activity_date, outcome')
      .in('contact_id', contactIds)
      .order('activity_date', { ascending: false })
      .limit(contactIds.length * 5),
    supabase
      .from('email_logs')
      .select('recipient_email, status')
      .gte('created_at', ninetyDaysAgo)
      .in('status', ['opened', 'clicked']),
    supabase
      .from('opportunities')
      .select('contact_id, stage, deal_value, opportunity_type, ai_deal_probability, ai_suggested_next_action')
      .in('contact_id', contactIds)
      .is('actual_close_date', null)
      .not('outcome', 'in', '(lost,withdrawn)'),
  ]);

  // Build per-contact activity map (keep latest 3 per contact)
  const activitiesMap = new Map<string, Array<{ type: string; date: string; outcome: string | null }>>();
  for (const act of activitiesResult.data ?? []) {
    const existing = activitiesMap.get(act.contact_id) ?? [];
    if (existing.length < 3) {
      existing.push({ type: act.activity_type, date: act.activity_date?.split('T')[0] ?? '', outcome: act.outcome });
      activitiesMap.set(act.contact_id, existing);
    }
  }

  // Build per-email engagement map
  const emailEngMap = new Map<string, { opens: number; clicks: number }>();
  for (const log of emailResult.data ?? []) {
    const key = (log.recipient_email ?? '').toLowerCase();
    if (!key) continue;
    const existing = emailEngMap.get(key) ?? { opens: 0, clicks: 0 };
    if (log.status === 'opened') existing.opens++;
    else if (log.status === 'clicked') existing.clicks++;
    emailEngMap.set(key, existing);
  }

  // Build per-contact active pipeline opportunity map
  const pipelineMap = new Map<string, { stage: string; deal_value: number | null; opportunity_type: string; ai_deal_probability: number | null; ai_suggested_next_action: string | null }>();
  for (const opp of pipelineResult.data ?? []) {
    if (!pipelineMap.has(opp.contact_id)) {
      pipelineMap.set(opp.contact_id, {
        stage: opp.stage,
        deal_value: opp.deal_value ?? null,
        opportunity_type: opp.opportunity_type ?? 'buyer',
        ai_deal_probability: opp.ai_deal_probability ?? null,
        ai_suggested_next_action: opp.ai_suggested_next_action ?? null,
      });
    }
  }

  const today = new Date().toISOString().split('T')[0];
  const now = Date.now();
  const contactMap = new Map(inScopeContacts.map(c => [c.id, c]));

  // Build context array for Claude — one entry per task
  const contactsContext = insertedTasks.flatMap(task => {
    const contact = contactMap.get(task.lead_id);
    if (!contact) return [];
    const daysSince = contact.last_activity_date
      ? Math.floor((now - new Date(contact.last_activity_date).getTime()) / (1000 * 60 * 60 * 24))
      : null;
    const emailKey = (contact.email ?? '').toLowerCase();
    const emailEng = emailEngMap.get(emailKey) ?? { opens: 0, clicks: 0 };
    const activePipeline = pipelineMap.get(contact.id) ?? null;
    return [{
      task_id: task.id,
      full_name: `${contact.first_name ?? ''} ${contact.last_name}`.trim(),
      task_type: task.task_type,
      days_since_last_touch: daysSince,
      activity_count: contact.activity_count ?? 0,
      recent_activities: activitiesMap.get(contact.id) ?? [],
      email_opens_90d: emailEng.opens,
      email_clicks_90d: emailEng.clicks,
      active_pipeline: activePipeline,  // null if not in pipeline
    }];
  });

  if (contactsContext.length === 0) return;

  const systemPrompt = `You are an AI assistant for a real estate agent's CRM. Score contacts for outreach priority based on relationship health signals. Today is ${today}, SphereSync week ${weekNumber}.

Score each contact 1–10 (10 = most urgent to reach out to) based on:
- Days since last touch: >90 days = very high urgency; 30–90 = moderate; <30 = lower
- Email engagement (opens/clicks in last 90 days) = strong interest signal — raise score
- Activity count: low lifetime activity = relationship needs nurturing
- Recent outcome: "no answer" or "voicemail" = follow-up needed
- PIPELINE BOOST: if active_pipeline is not null, this is an active deal — score must be at least 7. If ai_deal_probability is high (>60), score 9–10. The talking points MUST reference the deal stage and context (e.g. "Following up on your home search at [stage]").

For each contact provide:
1. score (integer 1–10)
2. reason (max 15 words, factual, e.g. "No contact in 73 days, opened 2 newsletters recently")
3. talking_points (array of exactly 2 short strings, each max 12 words, conversational openers suited to the task_type — for pipeline contacts, reference the deal stage or type)

Return ONLY a JSON array. No markdown, no explanation outside the JSON.`;

  const userMsg = `Score these ${contactsContext.length} contacts for week ${weekNumber} SphereSync outreach:\n\n${JSON.stringify(contactsContext, null, 2)}`;

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
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

  if (!resp.ok) throw new Error(`Anthropic API error: ${resp.status} ${await resp.text()}`);

  const claudeData = await resp.json();
  const rawText: string = claudeData?.content?.[0]?.text ?? '';

  let scored: Array<{ task_id: string; score: number; reason: string; talking_points: string[] }>;
  try {
    scored = JSON.parse(rawText);
  } catch {
    const match = rawText.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('Could not extract JSON array from Claude response');
    scored = JSON.parse(match[0]);
  }

  // Bulk-update tasks with AI fields
  const scoredAt = new Date().toISOString();
  for (const item of scored) {
    if (!item.task_id) continue;
    const score = Math.max(1, Math.min(10, Math.round(Number(item.score) || 5)));
    const { error: updateErr } = await supabase
      .from('spheresync_tasks')
      .update({
        ai_priority_score: score,
        ai_reason: item.reason ?? null,
        ai_talking_points: Array.isArray(item.talking_points) ? item.talking_points : null,
        ai_scored_at: scoredAt,
      })
      .eq('id', item.task_id);
    if (updateErr) console.warn(`AI score update failed for task ${item.task_id}:`, updateErr.message);
  }

  console.log(`AI scored ${scored.length} tasks for agent ${agentId}`);
}

// ── Handler ──────────────────────────────────────────────────────────────────

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = new Date();
  let runLogId: string | null = null;

  try {
    console.log('SphereSync task generation started');

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    const cronJobHeader = req.headers.get('X-Cron-Job');
    const sourceHeader = req.headers.get('source');
    const isCronJob = cronJobHeader === 'true' || sourceHeader === 'pg_cron';

    if (!isCronJob && (!authHeader || !authHeader.startsWith('Bearer '))) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (!isCronJob) {
      const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const token = authHeader!.replace('Bearer ', '');
      const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
      if (claimsError || !claimsData?.claims) {
        return new Response(
          JSON.stringify({ error: 'Invalid authentication' }),
          { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
      const { data: userRole, error: roleError } = await supabaseAuth.rpc('get_current_user_role');
      if (roleError || userRole !== 'admin') {
        return new Response(
          JSON.stringify({ error: 'Admin access required' }),
          { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
    }

    const body = await req.json();
    const {
      mode = 'global',
      agentId = null,
      scheduled_at = null,
      force_regenerate = false,
      week_number: overrideWeek = null,
      year: overrideYear = null,
      source = isCronJob ? 'pg_cron' : 'manual',
    } = body;

    let currentWeekTasks;
    if (overrideWeek && overrideYear) {
      currentWeekTasks = {
        weekNumber: overrideWeek,
        isoYear: overrideYear,
        callCategories: SPHERESYNC_CALLS[overrideWeek] || [],
        textCategory: SPHERESYNC_TEXTS[overrideWeek] || '',
      };
    } else {
      const referenceDate = scheduled_at ? new Date(scheduled_at) : new Date();
      currentWeekTasks = getCurrentWeekTasks(referenceDate);
    }

    console.log('Target week tasks:', currentWeekTasks);

    const { data: runLog, error: runLogError } = await supabase
      .from('spheresync_run_logs')
      .insert({
        run_type: 'generate',
        source,
        scheduled_at: scheduled_at || null,
        target_week_number: currentWeekTasks.weekNumber,
        target_year: currentWeekTasks.isoYear,
        force_regenerate,
        target_agent_id: agentId || null,
        status: 'running',
      })
      .select('id')
      .single();

    if (!runLogError) runLogId = runLog?.id;

    // ── Resolve agents ────────────────────────────────────────────────────────
    let agents: Array<{ user_id: string; first_name: string; last_name: string; email: string }> = [];

    if (mode === 'global') {
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['agent', 'admin']);
      if (rolesError) throw rolesError;
      const agentIds = userRoles?.map(r => r.user_id) || [];
      const { data: agentsData, error: agentsError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email')
        .in('user_id', agentIds);
      if (agentsError) throw agentsError;
      agents = (agentsData || []) as typeof agents;
    } else if (agentId) {
      const { data: agentData, error: agentError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email')
        .eq('user_id', agentId)
        .single();
      if (agentError) throw agentError;
      if (agentData) agents = [agentData as (typeof agents)[number]];
    }

    console.log(`Processing ${agents.length} agents`);

    const results: ProcessResult[] = [];
    let totalTasksCreated = 0;
    let agentsProcessed = 0;
    let agentsSkipped = 0;

    for (const agent of agents) {
      try {
        // ── Load contacts (enriched) ────────────────────────────────────────
        const { data: contacts, error: contactsError } = await supabase
          .from('contacts')
          .select('id, first_name, last_name, category, agent_id, email, last_activity_date, activity_count')
          .eq('agent_id', agent.user_id);

        if (contactsError) {
          results.push({ agent_id: agent.user_id, agent_name: `${agent.first_name} ${agent.last_name}`, error: `Failed to load contacts: ${contactsError.message}` });
          continue;
        }

        // Auto-assign categories to contacts missing them
        const contactsToUpdate = contacts?.filter((c: Contact) => !c.category) || [];
        if (contactsToUpdate.length > 0) {
          const updates = contactsToUpdate.map((c: Contact) => ({ ...c, category: c.last_name?.charAt(0).toUpperCase() || 'A' }));
          await supabase.from('contacts').upsert(updates);
        }

        const allContacts: Contact[] = (contacts?.map((c: Contact) => ({
          ...c,
          category: c.category || c.last_name?.charAt(0).toUpperCase() || 'A',
        })) || []);

        // ── Check for existing tasks ────────────────────────────────────────
        const { data: existingTasks, error: checkError } = await supabase
          .from('spheresync_tasks')
          .select('id, task_type')
          .eq('agent_id', agent.user_id)
          .eq('week_number', currentWeekTasks.weekNumber)
          .eq('year', currentWeekTasks.isoYear);

        if (checkError) {
          results.push({ agent_id: agent.user_id, agent_name: `${agent.first_name} ${agent.last_name}`, error: `Failed to check existing tasks: ${checkError.message}` });
          continue;
        }

        if (existingTasks && existingTasks.length > 0 && !force_regenerate) {
          agentsSkipped++;
          results.push({
            agent_id: agent.user_id,
            agent_name: `${agent.first_name} ${agent.last_name}`,
            contacts_total: allContacts.length,
            skipped: true,
            skipped_reason: `Tasks already exist for week ${currentWeekTasks.weekNumber}/${currentWeekTasks.isoYear} (${existingTasks.length} tasks). Use force_regenerate=true to recreate.`,
          });
          continue;
        }

        if (existingTasks && existingTasks.length > 0 && force_regenerate) {
          await supabase
            .from('spheresync_tasks')
            .delete()
            .eq('agent_id', agent.user_id)
            .eq('week_number', currentWeekTasks.weekNumber)
            .eq('year', currentWeekTasks.isoYear);
        }

        // ── Filter contacts by this week's categories ───────────────────────
        const validContacts = allContacts.filter((c: Contact) => c.agent_id === agent.user_id);
        const callContacts = validContacts.filter((c: Contact) => currentWeekTasks.callCategories.includes(c.category));
        const textContacts = validContacts.filter((c: Contact) => c.category === currentWeekTasks.textCategory);

        console.log(`Agent ${agent.user_id}: ${validContacts.length} contacts → ${callContacts.length} calls, ${textContacts.length} texts`);

        const tasksToInsert = [
          ...callContacts.map((c: Contact) => ({
            agent_id: agent.user_id,
            lead_id: c.id,
            task_type: 'call',
            week_number: currentWeekTasks.weekNumber,
            year: currentWeekTasks.isoYear,
            completed: false,
          })),
          ...textContacts.map((c: Contact) => ({
            agent_id: agent.user_id,
            lead_id: c.id,
            task_type: 'text',
            week_number: currentWeekTasks.weekNumber,
            year: currentWeekTasks.isoYear,
            completed: false,
          })),
        ];

        let insertedTasks: InsertedTask[] = [];

        if (tasksToInsert.length > 0) {
          const { data: inserted, error: insertError } = await supabase
            .from('spheresync_tasks')
            .insert(tasksToInsert)
            .select('id, lead_id, task_type');

          if (insertError) {
            if (insertError.code === '23505') {
              agentsSkipped++;
              results.push({ agent_id: agent.user_id, agent_name: `${agent.first_name} ${agent.last_name}`, skipped: true, skipped_reason: 'Duplicate tasks already exist' });
            } else {
              results.push({ agent_id: agent.user_id, agent_name: `${agent.first_name} ${agent.last_name}`, error: `Failed to insert tasks: ${insertError.message}` });
            }
            continue;
          }

          insertedTasks = (inserted || []) as InsertedTask[];
          console.log(`Generated ${insertedTasks.length} tasks for agent ${agent.user_id}`);
          totalTasksCreated += insertedTasks.length;
        }

        // ── AI Scoring (non-fatal) ──────────────────────────────────────────
        let aiScored = false;
        let aiScoringError: string | undefined;

        if (anthropicKey && insertedTasks.length > 0) {
          try {
            const inScopeContacts = [...callContacts, ...textContacts];
            await scoreTasksWithAI(supabase, agent.user_id, insertedTasks, inScopeContacts, anthropicKey, currentWeekTasks.weekNumber);
            aiScored = true;
          } catch (aiErr: any) {
            aiScoringError = aiErr?.message ?? 'Unknown AI scoring error';
            console.warn(`AI scoring failed for agent ${agent.user_id}:`, aiScoringError);
          }
        } else if (!anthropicKey) {
          aiScoringError = 'ANTHROPIC_API_KEY not configured';
        }

        agentsProcessed++;
        results.push({
          agent_id: agent.user_id,
          agent_name: `${agent.first_name} ${agent.last_name}`,
          contacts_total: validContacts.length,
          contacts_call: callContacts.length,
          contacts_text: textContacts.length,
          tasks_generated: insertedTasks.length,
          call_tasks: callContacts.length,
          text_tasks: textContacts.length,
          ai_scored: aiScored,
          ai_scoring_error: aiScoringError,
        });

      } catch (error: any) {
        console.error(`Error processing agent ${agent.user_id}:`, error);
        results.push({ agent_id: agent.user_id, agent_name: `${agent.first_name} ${agent.last_name}`, error: error.message });
      }
    }

    const generated = results.filter(r => r.tasks_generated !== undefined && !r.skipped && !r.error);
    const skipped = results.filter(r => r.skipped);
    const failed = results.filter(r => r.error);

    if (runLogId) {
      await supabase
        .from('spheresync_run_logs')
        .update({
          finished_at: new Date().toISOString(),
          status: failed.length > 0 && generated.length === 0 ? 'failed' : 'completed',
          agents_processed: agentsProcessed,
          agents_skipped: agentsSkipped,
          tasks_created: totalTasksCreated,
          agent_results: results,
          error_message: failed.length > 0 ? `${failed.length} agents failed` : null,
        })
        .eq('id', runLogId);
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'SphereSync tasks generated successfully',
      run_log_id: runLogId,
      week_number: currentWeekTasks.weekNumber,
      iso_year: currentWeekTasks.isoYear,
      call_categories: currentWeekTasks.callCategories,
      text_category: currentWeekTasks.textCategory,
      force_regenerate,
      summary: {
        agents_total: agents.length,
        agents_processed: generated.length,
        agents_skipped: skipped.length,
        agents_failed: failed.length,
        total_tasks_generated: totalTasksCreated,
      },
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Error in spheresync-generate-tasks function:', error);

    if (runLogId) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        if (supabaseUrl && supabaseServiceKey) {
          await createClient(supabaseUrl, supabaseServiceKey)
            .from('spheresync_run_logs')
            .update({ finished_at: new Date().toISOString(), status: 'failed', error_message: error.message })
            .eq('id', runLogId);
        }
      } catch (_) { /* swallow log update error */ }
    }

    return new Response(JSON.stringify({ success: false, error: error.message, run_log_id: runLogId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
};

Deno.serve(handler);
