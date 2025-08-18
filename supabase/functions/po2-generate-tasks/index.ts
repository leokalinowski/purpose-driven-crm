import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Weekly call categories mapping (2 categories per week)
const WEEKLY_CALLS: Record<number, string[]> = {
  1: ['A', 'W'], 2: ['B', 'E'], 3: ['D', 'O'], 4: ['H', 'V'], 5: ['C', 'K'],
  6: ['F', 'G'], 7: ['M', 'X'], 8: ['N', 'R'], 9: ['S', 'U'], 10: ['P', 'L'],
  11: ['T', 'J'], 12: ['I', 'Q'], 13: ['Y', 'Z'], 14: ['A', 'W'], 15: ['B', 'E'],
  16: ['D', 'O'], 17: ['H', 'V'], 18: ['C', 'K'], 19: ['F', 'G'], 20: ['M', 'X'],
  21: ['N', 'R'], 22: ['S', 'U'], 23: ['P', 'L'], 24: ['T', 'J'], 25: ['I', 'Q'],
  26: ['Y', 'Z'], 27: ['A', 'W'], 28: ['B', 'E'], 29: ['D', 'O'], 30: ['H', 'V'],
  31: ['C', 'K'], 32: ['F', 'G'], 33: ['M', 'X'], 34: ['N', 'R'], 35: ['S', 'U'],
  36: ['P', 'L'], 37: ['T', 'J'], 38: ['I', 'Q'], 39: ['Y', 'Z'], 40: ['A', 'W'],
  41: ['B', 'E'], 42: ['D', 'O'], 43: ['H', 'V'], 44: ['C', 'K'], 45: ['F', 'G'],
  46: ['M', 'X'], 47: ['N', 'R'], 48: ['S', 'U'], 49: ['P', 'L'], 50: ['T', 'J'],
  51: ['I', 'Q'], 52: ['Y', 'Z']
};

// Weekly text categories mapping (1 category per week, 26-week cycle)
const WEEKLY_TEXTS: Record<number, string> = {
  1: 'N', 2: 'S', 3: 'P', 4: 'T', 5: 'I', 6: 'Y', 7: 'X', 8: 'A', 9: 'B',
  10: 'D', 11: 'H', 12: 'C', 13: 'F', 14: 'R', 15: 'U', 16: 'L', 17: 'J',
  18: 'Q', 19: 'Z', 20: 'W', 21: 'E', 22: 'O', 23: 'V', 24: 'K', 25: 'G',
  26: 'M', 27: 'N', 28: 'S', 29: 'P', 30: 'T', 31: 'I', 32: 'Y', 33: 'X',
  34: 'A', 35: 'B', 36: 'D', 37: 'H', 38: 'C', 39: 'F', 40: 'R', 41: 'U',
  42: 'L', 43: 'J', 44: 'Q', 45: 'Z', 46: 'W', 47: 'E', 48: 'O', 49: 'V',
  50: 'K', 51: 'G', 52: 'M'
};

function getCurrentWeekNumber(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  
  // Get the day of the week for January 1st (0 = Sunday, 1 = Monday, etc.)
  const startDay = start.getDay();
  
  // Calculate days since January 1st
  const daysSinceStart = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  
  // Adjust for the first week (ISO 8601: week starts on Monday)
  const adjustedDays = daysSinceStart + (startDay === 0 ? 6 : startDay - 1);
  
  // Calculate week number
  const weekNumber = Math.ceil((adjustedDays + 1) / 7);
  
  // Ensure we stay within 1-52 range
  return Math.min(Math.max(weekNumber, 1), 52);
}

function getCurrentWeekTasks() {
  const weekNumber = getCurrentWeekNumber();
  return {
    weekNumber,
    callCategories: WEEKLY_CALLS[weekNumber] || [],
    textCategory: WEEKLY_TEXTS[weekNumber] || ''
  };
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