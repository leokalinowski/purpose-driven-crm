import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';
import { corsHeaders } from "../_shared/cors.ts";

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

/**
 * Calculate ISO 8601 week number and year
 * Handles year boundaries correctly (e.g., Dec 29, 2025 = Week 1 of 2026)
 */
function getISOWeekNumber(date: Date = new Date()): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7; // Make Sunday = 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // Set to nearest Thursday
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { week: weekNumber, year: d.getUTCFullYear() };
}

/**
 * Get current week's call and text categories with ISO year
 * Optionally accepts a date to compute week/year from (for scheduled_at support)
 */
function getCurrentWeekTasks(referenceDate?: Date) {
  const { week, year } = getISOWeekNumber(referenceDate);
  const weekNumber = Math.min(week, 52); // Map to our 52-week system
  return {
    weekNumber,
    isoYear: year, // Use ISO year for correct year boundary handling
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

interface Agent {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface ProcessResult {
  agent_id: string;
  agent_name: string;
  tasks_generated?: number;
  call_tasks?: number;
  text_tasks?: number;
  skipped?: boolean;
  skipped_reason?: string;
  error?: string;
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
      console.error("Missing Supabase environment variables");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create Supabase client for authentication check
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // For non-admin users, require authentication (but allow cron jobs without auth)
    const authHeader = req.headers.get('Authorization');
    const cronJobHeader = req.headers.get('X-Cron-Job');
    const sourceHeader = req.headers.get('source');
    const isCronJob = cronJobHeader === 'true' || sourceHeader === 'pg_cron';

    console.log(`Authentication check - isCronJob: ${isCronJob}, X-Cron-Job header: ${cronJobHeader}, source header: ${sourceHeader}`);

    if (!isCronJob && (!authHeader || !authHeader.startsWith('Bearer '))) {
      console.error('Authentication failed - no valid auth header and not a cron job');
      console.error('Headers received:', JSON.stringify(Object.fromEntries([...req.headers.entries()])));
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!isCronJob) {
      // Verify user is authenticated and is admin
      const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey, {
        global: { headers: { Authorization: authHeader } }
      });

      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: "Invalid authentication" }),
          { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Check if user is admin
      const { data: userRole, error: roleError } = await supabaseAuth
        .rpc('get_current_user_role');

      if (roleError || userRole !== 'admin') {
        return new Response(
          JSON.stringify({ error: "Admin access required" }),
          { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // Parse request body
    const body = await req.json();
    const { 
      mode = 'global', 
      agentId = null,
      scheduled_at = null,
      force_regenerate = false,
      week_number: overrideWeek = null,
      year: overrideYear = null
    } = body;

    console.log(`Processing mode: ${mode}, agentId: ${agentId}, force_regenerate: ${force_regenerate}`);
    if (scheduled_at) {
      console.log(`Using scheduled_at for week calculation: ${scheduled_at}`);
    }
    if (overrideWeek && overrideYear) {
      console.log(`Using override week/year: Week ${overrideWeek}/${overrideYear}`);
    }

    // Determine reference date for week/year calculation
    // Priority: 1) explicit week/year override, 2) scheduled_at, 3) now()
    let currentWeekTasks;
    if (overrideWeek && overrideYear) {
      // Use explicit override
      currentWeekTasks = {
        weekNumber: overrideWeek,
        isoYear: overrideYear,
        callCategories: SPHERESYNC_CALLS[overrideWeek] || [],
        textCategory: SPHERESYNC_TEXTS[overrideWeek] || ''
      };
    } else {
      const referenceDate = scheduled_at ? new Date(scheduled_at) : new Date();
      currentWeekTasks = getCurrentWeekTasks(referenceDate);
    }
    
    console.log('Target week tasks:', currentWeekTasks);

    let agents: Agent[] = [];

    if (mode === 'global') {
      // Get all agents from user_roles table
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['agent', 'admin']);

      if (rolesError) {
        console.error('Error fetching user roles:', rolesError);
        throw rolesError;
      }

      const agentIds = userRoles?.map(r => r.user_id) || [];

      // Fetch profiles for these users
      const { data: agentsData, error: agentsError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email')
        .in('user_id', agentIds);

      if (agentsError) {
        console.error('Error fetching agents:', agentsError);
        throw agentsError;
      }

      agents = (agentsData || []) as Agent[];
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

      agents = agentData ? [agentData as Agent] : [];
    }

    console.log(`Processing ${agents.length} agents`);

    const results: ProcessResult[] = [];

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

        // Check if tasks already exist for this agent and week (use ISO year)
        const { data: existingTasks, error: checkError } = await supabase
          .from('spheresync_tasks')
          .select('id, task_type')
          .eq('agent_id', agent.user_id)
          .eq('week_number', currentWeekTasks.weekNumber)
          .eq('year', currentWeekTasks.isoYear);

        if (checkError) {
          console.error(`Error checking existing tasks for agent ${agent.user_id}:`, checkError);
          continue;
        }

        // If tasks already exist and force_regenerate is not set, skip this agent
        if (existingTasks && existingTasks.length > 0 && !force_regenerate) {
          console.log(`Tasks already exist for agent ${agent.user_id} (week ${currentWeekTasks.weekNumber}/${currentWeekTasks.isoYear}), skipping (use force_regenerate to override)`);
          results.push({
            agent_id: agent.user_id,
            agent_name: `${agent.first_name} ${agent.last_name}`,
            skipped: true,
            skipped_reason: `Tasks already exist for week ${currentWeekTasks.weekNumber}/${currentWeekTasks.isoYear} (${existingTasks.length} tasks). Use force_regenerate=true to recreate.`
          });
          continue;
        }

        // If tasks exist and force_regenerate is set, delete them first
        if (existingTasks && existingTasks.length > 0 && force_regenerate) {
          console.log(`Force regenerating: deleting ${existingTasks.length} existing tasks for agent ${agent.user_id}`);
          
          const { error: deleteError } = await supabase
            .from('spheresync_tasks')
            .delete()
            .eq('agent_id', agent.user_id)
            .eq('week_number', currentWeekTasks.weekNumber)
            .eq('year', currentWeekTasks.isoYear);

          if (deleteError) {
            console.error(`Error deleting existing tasks for agent ${agent.user_id}:`, deleteError);
            continue;
          }
        }

        // CRITICAL: Validate all contacts belong to this agent
        const validContacts = allContacts.filter((contact: Contact) => contact.agent_id === agent.user_id);
        
        if (validContacts.length < allContacts.length) {
          console.warn(`Agent ${agent.user_id}: Filtered out ${allContacts.length - validContacts.length} contacts not owned by agent`);
        }

        // Filter contacts by categories
        const callContacts = validContacts.filter((contact: Contact) => 
          currentWeekTasks.callCategories.includes(contact.category)
        );
        const textContacts = validContacts.filter((contact: Contact) => 
          contact.category === currentWeekTasks.textCategory
        );

        console.log(`Agent ${agent.user_id}: ${callContacts.length} call tasks, ${textContacts.length} text tasks`);

        const tasksToInsert = [
          ...callContacts.map((contact: Contact) => ({
            agent_id: agent.user_id,
            lead_id: contact.id,
            task_type: 'call',
            week_number: currentWeekTasks.weekNumber,
            year: currentWeekTasks.isoYear,
            completed: false
          })),
          ...textContacts.map((contact: Contact) => ({
            agent_id: agent.user_id,
            lead_id: contact.id,
            task_type: 'text',
            week_number: currentWeekTasks.weekNumber,
            year: currentWeekTasks.isoYear,
            completed: false
          }))
        ];

        if (tasksToInsert.length > 0) {
          const { error: insertError } = await supabase
            .from('spheresync_tasks')
            .insert(tasksToInsert);

          if (insertError) {
            // Handle duplicate key errors gracefully
            if (insertError.code === '23505') {
              console.warn(`Duplicate tasks detected for agent ${agent.user_id}, skipping`);
            } else {
              console.error(`Error inserting tasks for agent ${agent.user_id}:`, insertError);
            }
            continue;
          }

          console.log(`Generated ${tasksToInsert.length} tasks for agent ${agent.user_id}`);
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
    
    // Calculate summary stats
    const generated = results.filter(r => r.tasks_generated !== undefined && !r.skipped);
    const skipped = results.filter(r => r.skipped);
    const failed = results.filter(r => r.error);
    
    return new Response(JSON.stringify({
      success: true,
      message: 'SphereSync tasks generated successfully',
      week_number: currentWeekTasks.weekNumber,
      iso_year: currentWeekTasks.isoYear,
      call_categories: currentWeekTasks.callCategories,
      text_category: currentWeekTasks.textCategory,
      force_regenerate: force_regenerate,
      summary: {
        agents_processed: agents.length,
        agents_generated: generated.length,
        agents_skipped: skipped.length,
        agents_failed: failed.length,
        total_tasks_generated: generated.reduce((sum, r) => sum + (r.tasks_generated || 0), 0)
      },
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
