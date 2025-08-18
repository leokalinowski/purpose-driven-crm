import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCurrentWeekTasks } from '../../../src/utils/po2Logic.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Contact {
  id: string;
  first_name?: string;
  last_name: string;
  phone?: string;
  category: string;
  agent_id: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { mode = 'global', agentId } = await req.json().catch(() => ({}));
    
    console.log(`PO2 Generate Tasks: mode=${mode}, agentId=${agentId}`);
    
    const currentWeek = getCurrentWeekTasks();
    const year = new Date().getFullYear();

    let agentsToProcess: { id: string }[] = [];

    if (mode === 'global') {
      // Get all agents
      const { data: agents, error: agentsError } = await supabaseClient
        .from('profiles')
        .select('user_id')
        .eq('role', 'agent');

      if (agentsError) throw agentsError;
      agentsToProcess = agents.map(a => ({ id: a.user_id }));
    } else if (agentId) {
      agentsToProcess = [{ id: agentId }];
    } else {
      throw new Error('Either mode=global or agentId must be provided');
    }

    console.log(`Processing ${agentsToProcess.length} agents for week ${currentWeek.weekNumber}`);

    let totalTasksGenerated = 0;
    const results = [];

    for (const agent of agentsToProcess) {
      try {
        // Load agent's contacts
        const { data: contacts, error: contactsError } = await supabaseClient
          .from('contacts')
          .select('*')
          .eq('agent_id', agent.id);

        if (contactsError) {
          console.error(`Error loading contacts for agent ${agent.id}:`, contactsError);
          continue;
        }

        // Auto-set category if missing
        const updatedContacts = contacts.map(c => {
          if (!c.category && c.last_name) {
            return { ...c, category: c.last_name.charAt(0).toUpperCase() };
          }
          return c;
        });

        // Update contacts with categories if changed
        const contactsNeedingUpdate = updatedContacts.filter((c, i) => c.category !== contacts[i].category);
        if (contactsNeedingUpdate.length > 0) {
          await supabaseClient.from('contacts').upsert(contactsNeedingUpdate, { onConflict: 'id' });
        }

        // Delete existing tasks for this week
        await supabaseClient
          .from('po2_tasks')
          .delete()
          .eq('agent_id', agent.id)
          .eq('week_number', currentWeek.weekNumber)
          .eq('year', year);

        // Generate new tasks
        const callContacts = updatedContacts.filter(c => currentWeek.callCategories.includes(c.category));
        const textContacts = updatedContacts.filter(c => c.category === currentWeek.textCategory);

        const callTasks = callContacts.map(c => ({
          task_type: 'call',
          lead_id: c.id,
          agent_id: agent.id,
          week_number: currentWeek.weekNumber,
          year
        }));

        const textTasks = textContacts.map(c => ({
          task_type: 'text',
          lead_id: c.id,
          agent_id: agent.id,
          week_number: currentWeek.weekNumber,
          year
        }));

        const allTasks = [...callTasks, ...textTasks];

        if (allTasks.length > 0) {
          const { error: insertError } = await supabaseClient
            .from('po2_tasks')
            .insert(allTasks);

          if (insertError) {
            console.error(`Error inserting tasks for agent ${agent.id}:`, insertError);
            continue;
          }
        }

        totalTasksGenerated += allTasks.length;
        results.push({
          agentId: agent.id,
          tasksGenerated: allTasks.length,
          calls: callTasks.length,
          texts: textTasks.length
        });

        console.log(`Generated ${allTasks.length} tasks for agent ${agent.id} (${callTasks.length} calls, ${textTasks.length} texts)`);

      } catch (agentError) {
        console.error(`Error processing agent ${agent.id}:`, agentError);
        results.push({
          agentId: agent.id,
          error: agentError.message,
          tasksGenerated: 0
        });
      }
    }

    console.log(`PO2 Generate Tasks completed: ${totalTasksGenerated} total tasks generated`);

    return new Response(JSON.stringify({
      success: true,
      week: currentWeek.weekNumber,
      year,
      totalTasksGenerated,
      agentsProcessed: agentsToProcess.length,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in po2-generate-tasks function:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});