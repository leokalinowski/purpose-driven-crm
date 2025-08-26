import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

// SphereSync Method - Balanced letter distribution for weekly contact assignments
// Based on English surname frequency analysis for more even task distribution

// Balanced weekly call categories mapping (2 categories per week)
const SPHERESYNC_CALLS: Record<number, string[]> = {
  // Q1 - January to March (weeks 1-13)
  1: ['S', 'Q'], 2: ['M', 'X'], 3: ['B', 'Y'], 4: ['C', 'Z'], 5: ['H', 'U'], 
  6: ['W', 'E'], 7: ['L', 'I'], 8: ['R', 'O'], 9: ['T', 'V'], 10: ['P', 'J'],
  11: ['A', 'K'], 12: ['D', 'N'], 13: ['F', 'G'],
  
  // Q2 - April to June (weeks 14-26)  
  14: ['S', 'X'], 15: ['M', 'Y'], 16: ['B', 'Z'], 17: ['C', 'U'], 18: ['H', 'E'],
  19: ['W', 'I'], 20: ['L', 'O'], 21: ['R', 'V'], 22: ['T', 'J'], 23: ['P', 'K'],
  24: ['A', 'N'], 25: ['D', 'G'], 26: ['F', 'Q'],
  
  // Q3 - July to September (weeks 27-39)
  27: ['S', 'Y'], 28: ['M', 'Z'], 29: ['B', 'U'], 30: ['C', 'E'], 31: ['H', 'I'],
  32: ['W', 'O'], 33: ['L', 'V'], 34: ['R', 'J'], 35: ['T', 'K'], 36: ['P', 'N'],
  37: ['A', 'G'], 38: ['D', 'Q'], 39: ['F', 'X'],
  
  // Q4 - October to December (weeks 40-52)
  40: ['S', 'Z'], 41: ['M', 'U'], 42: ['B', 'E'], 43: ['C', 'I'], 44: ['H', 'O'],
  45: ['W', 'V'], 46: ['L', 'J'], 47: ['R', 'K'], 48: ['T', 'N'], 49: ['P', 'G'],
  50: ['A', 'Q'], 51: ['D', 'X'], 52: ['F', 'Y']
};

// Balanced weekly text categories (1 category per week)
const SPHERESYNC_TEXTS: Record<number, string> = {
  // Q1 - Focus on medium-high frequency letters for New Year motivation
  1: 'M', 2: 'B', 3: 'C', 4: 'H', 5: 'W', 6: 'L', 7: 'R', 8: 'T', 9: 'P',
  10: 'A', 11: 'D', 12: 'F', 13: 'G',
  
  // Q2 - Spring mix with some high-frequency letters
  14: 'S', 15: 'K', 16: 'N', 17: 'V', 18: 'J', 19: 'E', 20: 'I', 21: 'O',
  22: 'U', 23: 'M', 24: 'B', 25: 'C', 26: 'H',
  
  // Q3 - Summer balance with remaining letters  
  27: 'W', 28: 'L', 29: 'R', 30: 'T', 31: 'P', 32: 'A', 33: 'D', 34: 'F',
  35: 'G', 36: 'S', 37: 'K', 38: 'N', 39: 'V',
  
  // Q4 - End of year with low-frequency letters mixed with high
  40: 'J', 41: 'E', 42: 'I', 43: 'O', 44: 'U', 45: 'Q', 46: 'X', 47: 'Y', 
  48: 'Z', 49: 'M', 50: 'B', 51: 'C', 52: 'H'
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Calculate the current week number of the year (1-52) using ISO 8601 standard
 */
function getCurrentWeekNumber(date: Date = new Date()): number {
  const start = new Date(date.getFullYear(), 0, 1);
  const startDay = start.getDay();
  const daysSinceStart = Math.floor((date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const adjustedDays = daysSinceStart + (startDay === 0 ? 6 : startDay - 1);
  const weekNumber = Math.ceil((adjustedDays + 1) / 7);
  return Math.min(Math.max(weekNumber, 1), 52);
}

/**
 * Get current week's call and text categories
 */
function getCurrentWeekTasks() {
  const weekNumber = getCurrentWeekNumber();
  return {
    weekNumber,
    callCategories: SPHERESYNC_CALLS[weekNumber] || [],
    textCategory: SPHERESYNC_TEXTS[weekNumber] || ''
  };
}

interface Contact {
  id: string;
  last_name: string;
  category: string;
  agent_id: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('SphereSync task generation started');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Parse request body
    const body = await req.json();
    const { mode = 'global', agentId = null } = body;

    console.log(`Processing mode: ${mode}, agentId: ${agentId}`);

    // Get current week tasks
    const currentWeekTasks = getCurrentWeekTasks();
    console.log('Current week tasks:', currentWeekTasks);

    let agents = [];
    
    if (mode === 'global') {
      // Get all agents
      const { data: agentsData, error: agentsError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email')
        .eq('role', 'agent');

      if (agentsError) {
        console.error('Error fetching agents:', agentsError);
        throw agentsError;
      }

      agents = agentsData || [];
    } else if (agentId) {
      // Get specific agent
      const { data: agentData, error: agentError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email')
        .eq('user_id', agentId)
        .single();

      if (agentError) {
        console.error('Error fetching agent:', agentError);
        throw agentError;
      }

      agents = agentData ? [agentData] : [];
    }

    console.log(`Processing ${agents.length} agents`);

    const results = [];

    // Process each agent
    for (const agent of agents) {
      try {
        console.log(`Processing agent: ${agent.user_id}`);

        // Load contacts for this agent
        const { data: contacts, error: contactsError } = await supabase
          .from('contacts')
          .select('id, last_name, category, agent_id')
          .eq('agent_id', agent.user_id);

        if (contactsError) {
          console.error(`Error loading contacts for agent ${agent.user_id}:`, contactsError);
          continue;
        }

        // Auto-assign categories to contacts without them
        const contactsToUpdate = contacts?.filter((contact: Contact) => !contact.category) || [];
        
        if (contactsToUpdate.length > 0) {
          console.log(`Auto-assigning categories to ${contactsToUpdate.length} contacts`);
          
          const updates = contactsToUpdate.map((contact: Contact) => ({
            ...contact,
            category: contact.last_name?.charAt(0).toUpperCase() || 'A'
          }));

          const { error: updateError } = await supabase
            .from('contacts')
            .upsert(updates);

          if (updateError) {
            console.error('Error updating contact categories:', updateError);
          }
        }

        // Get updated contacts list
        const allContacts = contacts?.map((contact: Contact) => ({
          ...contact,
          category: contact.category || contact.last_name?.charAt(0).toUpperCase() || 'A'
        })) || [];

        // Delete existing tasks for current week and year
        const currentYear = new Date().getFullYear();
        const { error: deleteError } = await supabase
          .from('spheresync_tasks')
          .delete()
          .eq('agent_id', agent.user_id)
          .eq('week_number', currentWeekTasks.weekNumber)
          .eq('year', currentYear);

        if (deleteError) {
          console.error(`Error deleting existing tasks for agent ${agent.user_id}:`, deleteError);
        }

        // Filter contacts by categories
        const callContacts = allContacts.filter((contact: Contact) => 
          currentWeekTasks.callCategories.includes(contact.category)
        );
        const textContacts = allContacts.filter((contact: Contact) => 
          contact.category === currentWeekTasks.textCategory
        );

        console.log(`Agent ${agent.user_id}: ${callContacts.length} call tasks, ${textContacts.length} text tasks`);

        // Generate tasks
        const tasksToInsert = [
          ...callContacts.map((contact: Contact) => ({
            agent_id: agent.user_id,
            lead_id: contact.id,
            task_type: 'call',
            week_number: currentWeekTasks.weekNumber,
            year: currentYear,
            completed: false
          })),
          ...textContacts.map((contact: Contact) => ({
            agent_id: agent.user_id,
            lead_id: contact.id,
            task_type: 'text',
            week_number: currentWeekTasks.weekNumber,
            year: currentYear,
            completed: false
          }))
        ];

        if (tasksToInsert.length > 0) {
          const { error: insertError } = await supabase
            .from('spheresync_tasks')
            .insert(tasksToInsert);

          if (insertError) {
            console.error(`Error inserting tasks for agent ${agent.user_id}:`, insertError);
            throw insertError;
          }
        }

        results.push({
          agent_id: agent.user_id,
          agent_name: `${agent.first_name} ${agent.last_name}`,
          tasks_generated: tasksToInsert.length,
          call_tasks: callContacts.length,
          text_tasks: textContacts.length
        });

      } catch (error) {
        console.error(`Error processing agent ${agent.user_id}:`, error);
        results.push({
          agent_id: agent.user_id,
          agent_name: `${agent.first_name} ${agent.last_name}`,
          error: error.message
        });
      }
    }

    console.log('SphereSync task generation completed');
    
    return new Response(JSON.stringify({
      success: true,
      message: 'SphereSync tasks generated successfully',
      week_number: currentWeekTasks.weekNumber,
      year: new Date().getFullYear(),
      call_categories: currentWeekTasks.callCategories,
      text_category: currentWeekTasks.textCategory,
      agents_processed: agents.length,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in spheresync-generate-tasks function:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
};

serve(handler);