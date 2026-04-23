/**
 * pipeline-stage-tasks
 *
 * Generates pipeline tasks from playbooks when an opportunity moves to a new stage.
 * Fast, no Claude call — just playbook lookup + task insertion.
 *
 * POST body:
 *   { opportunity_id, new_stage, pipeline_type, agent_id }
 *
 * Auth: admin Bearer token or X-Cron-Job header.
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
  if (!supabaseUrl || !supabaseKey) return json({ error: 'Missing Supabase env vars' }, 500);

  // ── Auth ──────────────────────────────────────────────────────────────────
  const isCron = req.headers.get('X-Cron-Job') === 'true';
  const authHeader = req.headers.get('Authorization');

  if (!isCron) {
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Authentication required' }, 401);
    const { data: role } = await createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    }).rpc('get_current_user_role');
    if (role !== 'admin') return json({ error: 'Admin access required' }, 403);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const body = await req.json().catch(() => ({}));
  const { opportunity_id, new_stage, pipeline_type, agent_id } = body;

  if (!opportunity_id || !new_stage || !agent_id) {
    return json({ error: 'opportunity_id, new_stage, and agent_id are required' }, 400);
  }

  const resolvedPipelineType = pipeline_type ?? 'buyer';

  try {
    // ── Fetch playbook tasks for this stage ──────────────────────────────
    // Agent overrides take precedence over system defaults
    const { data: agentPlaybooks } = await supabase
      .from('pipeline_stage_playbooks')
      .select('*')
      .eq('pipeline_type', resolvedPipelineType)
      .eq('stage', new_stage)
      .eq('agent_id', agent_id)
      .eq('is_active', true)
      .order('sort_order');

    let playbooks = agentPlaybooks ?? [];

    // Fall back to system defaults if no agent customisations exist
    if (playbooks.length === 0) {
      const { data: systemPlaybooks } = await supabase
        .from('pipeline_stage_playbooks')
        .select('*')
        .eq('pipeline_type', resolvedPipelineType)
        .eq('stage', new_stage)
        .is('agent_id', null)
        .eq('is_active', true)
        .order('sort_order');
      playbooks = systemPlaybooks ?? [];
    }

    if (playbooks.length === 0) {
      return json({ success: true, tasks_created: 0, message: 'No playbook found for this stage' });
    }

    // ── Fetch opportunity to get contact_id ──────────────────────────────
    const { data: opp } = await supabase
      .from('opportunities')
      .select('contact_id')
      .eq('id', opportunity_id)
      .single();

    // ── Build tasks to insert ────────────────────────────────────────────
    const today = new Date();
    const tasksToInsert = playbooks.map((pb: any, i: number) => {
      const dueDate = new Date(today);
      dueDate.setDate(dueDate.getDate() + (pb.due_days_offset ?? 1));
      return {
        opportunity_id,
        agent_id,
        contact_id: opp?.contact_id ?? null,
        task_type: pb.task_type,
        title: pb.title,
        description: pb.description ?? null,
        due_date: dueDate.toISOString().split('T')[0],
        priority: pb.priority ?? 5,
        sort_order: i,
        auto_generated: true,
        playbook_stage: new_stage,
        completed: false,
      };
    });

    const { data: inserted, error: insertErr } = await supabase
      .from('pipeline_tasks')
      .insert(tasksToInsert)
      .select('id, title, due_date, task_type');

    if (insertErr) throw insertErr;

    console.log(`Created ${inserted?.length ?? 0} tasks for opportunity ${opportunity_id} stage ${new_stage}`);

    return json({
      success: true,
      tasks_created: inserted?.length ?? 0,
      tasks: inserted,
    });
  } catch (err: any) {
    console.error('pipeline-stage-tasks error:', err.message);
    return json({ success: false, error: err.message }, 500);
  }
});
