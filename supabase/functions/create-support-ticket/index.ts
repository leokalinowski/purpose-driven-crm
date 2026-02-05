import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

interface TicketRequest {
  agent_id: string;
  category: string;
  subject: string;
  description?: string;
  priority: string;
}

interface AgentProfile {
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  email: string | null;
  phone_number: string | null;
  office_number: string | null;
  brokerage: string | null;
  team_name: string | null;
  license_number: string | null;
  license_states: string[] | null;
  state_licenses: string[] | null;
  office_address: string | null;
  website: string | null;
  created_at: string | null;
}

interface PlatformMetrics {
  databaseSize: number;
  tasksThisWeek: number;
  tasksCompleted: number;
  scoreboardStatus: string;
  lastCoachingDate: string | null;
  openTickets: number;
  pendingActionItems: number;
}

// ClickUp Custom Field IDs for Hub Agent Support list
const CLICKUP_FIELDS = {
  AGENT: 'c347f26e-8bb8-4f72-bc50-42345a3fe968',
  INQUIRY_TYPE: '267ad28f-645f-45de-b8a2-f099e2638c47',
  SEVERITY_LEVEL: '24eafe43-eabb-4070-949c-ca79b08c157d',
  CLIENT_PHONE: '0c867ff1-5163-44fb-a9d9-95904cf12adc',
};

// Map agent names to ClickUp dropdown option IDs
const AGENT_OPTIONS: Record<string, string> = {
  'Timothy Raiford': 'aec49918-45e4-46df-b3dd-7c6c27955fb4',
  'Ashley Spencer': '5ce25804-6585-4835-b37d-631815e6ffe2',
  'Rashida Lambert': '6385b226-5d32-4b03-9863-cca4b8c8a4f8',
  'Amy Summersgill': 'ab820fd5-3b7b-421f-a0fc-7448f91c20d9',
  'Jeffrey Pennington': 'f6afe6fe-df7d-4e57-8f0a-9dc74c33ded6',
  'Rebecca Williams': 'd187162b-eb3c-4651-bc3d-149ccd6e43e2',
  'Bluejay Properties': '2df98e21-04e6-4c2f-8d75-d61c4dcdada0',
  'Traci Johnson': 'fc947195-6fbd-46af-8206-2081f8ed3528',
};

// Map inquiry type (category) to ClickUp dropdown option IDs
const INQUIRY_TYPE_OPTIONS: Record<string, string> = {
  'general': '3a45e9fd-9d11-49f6-ad71-c8e78e9653d7',
  'database': 'd54ab778-c6f7-4f54-a1aa-087ca7ebd962',
  'social': 'd54ab778-c6f7-4f54-a1aa-087ca7ebd962',
  'events': 'd54ab778-c6f7-4f54-a1aa-087ca7ebd962',
  'newsletter': 'd54ab778-c6f7-4f54-a1aa-087ca7ebd962',
  'spheresync': 'd54ab778-c6f7-4f54-a1aa-087ca7ebd962',
  'technical': 'd54ab778-c6f7-4f54-a1aa-087ca7ebd962',
  'coaching': '0f1f6aac-1a12-4a15-9daa-b3b3f23b3cf7',
};

// Map priority to ClickUp severity dropdown option IDs
const SEVERITY_OPTIONS: Record<string, string> = {
  'high': '7616aa5e-cfc5-4303-bbd8-e2aaac0b156e',
  'medium': '8a6d08e0-d273-4757-8078-05c7c7cc354f',
  'low': '3e54e01d-8d4a-4549-b24b-21b4b2719b35',
};

// Get current ISO week number and year
function getCurrentWeekInfo(): { week: number; year: number } {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const week = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  return { week, year: now.getFullYear() };
}

// Format date for display
function formatDate(dateString: string | null): string {
  if (!dateString) return 'Not available';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  } catch {
    return 'Not available';
  }
}

// Format phone for display
function formatPhone(phone: string | null): string {
  if (!phone) return 'Not provided';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const clickupApiToken = Deno.env.get('CLICKUP_API_TOKEN');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: TicketRequest = await req.json();
    console.log('Creating support ticket:', body);

    if (!body.category || !body.subject || !body.priority) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: category, subject, priority' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch comprehensive agent profile
    const { data: profile } = await supabase
      .from('profiles')
      .select(`
        first_name, last_name, full_name, email, phone_number,
        office_number, brokerage, team_name, license_number,
        license_states, state_licenses, office_address, website, created_at
      `)
      .eq('user_id', user.id)
      .single();

    const agentProfile = profile as AgentProfile | null;
    const agentName = agentProfile?.full_name || 
      (agentProfile ? `${agentProfile.first_name || ''} ${agentProfile.last_name || ''}`.trim() : 'Unknown Agent');
    const agentEmail = agentProfile?.email || user.email || 'unknown';
    const agentPhone = agentProfile?.phone_number || '';

    console.log('Agent info:', { agentName, agentEmail });

    // Fetch platform metrics in parallel
    const { week: currentWeek, year: currentYear } = getCurrentWeekInfo();

    const [
      databaseSizeResult,
      tasksThisWeekResult,
      tasksCompletedResult,
      latestCoachingResult,
      openTicketsResult,
      pendingActionItemsResult
    ] = await Promise.all([
      // Database size
      supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', user.id),
      
      // SphereSync tasks this week
      supabase
        .from('spheresync_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', user.id)
        .eq('week_number', currentWeek)
        .eq('year', currentYear),
      
      // Completed tasks this week
      supabase
        .from('spheresync_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', user.id)
        .eq('week_number', currentWeek)
        .eq('year', currentYear)
        .eq('completed', true),
      
      // Latest coaching submission
      supabase
        .from('coaching_submissions')
        .select('week_ending, week_number, year')
        .eq('agent_id', user.id)
        .order('week_ending', { ascending: false })
        .limit(1)
        .maybeSingle(),
      
      // Open tickets count
      supabase
        .from('support_tickets')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', user.id)
        .in('status', ['open', 'in_progress']),
      
      // Pending action items
      supabase
        .from('agent_action_items')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', user.id)
        .is('resolved_at', null)
        .eq('is_dismissed', false)
    ]);

    // Calculate scoreboard status
    let scoreboardStatus = 'Not Submitted';
    const latestCoaching = latestCoachingResult.data;
    if (latestCoaching) {
      if (latestCoaching.week_number === currentWeek && latestCoaching.year === currentYear) {
        scoreboardStatus = `Submitted (Week ${currentWeek}, ${currentYear})`;
      } else if (
        latestCoaching.year < currentYear || 
        (latestCoaching.year === currentYear && latestCoaching.week_number < currentWeek - 1)
      ) {
        scoreboardStatus = `Overdue (Last: Week ${latestCoaching.week_number}, ${latestCoaching.year})`;
      } else {
        scoreboardStatus = `Last: Week ${latestCoaching.week_number}, ${latestCoaching.year}`;
      }
    }

    const metrics: PlatformMetrics = {
      databaseSize: databaseSizeResult.count || 0,
      tasksThisWeek: tasksThisWeekResult.count || 0,
      tasksCompleted: tasksCompletedResult.count || 0,
      scoreboardStatus,
      lastCoachingDate: latestCoaching?.week_ending || null,
      openTickets: openTicketsResult.count || 0,
      pendingActionItems: pendingActionItemsResult.count || 0,
    };

    console.log('Platform metrics:', metrics);

    // Get support config for assignee
    const { data: config } = await supabase
      .from('support_config')
      .select('clickup_assignee_id, assignee_name')
      .eq('category', body.category)
      .single();

    let clickupTaskId: string | null = null;
    let assignedTo: string | null = config?.assignee_name || null;

    // Create ClickUp task if API token is configured
    const clickupListId = Deno.env.get('CLICKUP_SUPPORT_LIST_ID');
    
    if (clickupApiToken && clickupListId) {
      try {
        console.log('Creating ClickUp task in list:', clickupListId);
        
        const priorityMap: Record<string, number> = {
          'high': 2,
          'medium': 3,
          'low': 4,
        };

        const customFields: Array<{ id: string; value: any }> = [];

        const agentOptionId = findAgentOption(agentName);
        if (agentOptionId) {
          customFields.push({
            id: CLICKUP_FIELDS.AGENT,
            value: agentOptionId,
          });
        }

        const inquiryTypeId = INQUIRY_TYPE_OPTIONS[body.category];
        if (inquiryTypeId) {
          customFields.push({
            id: CLICKUP_FIELDS.INQUIRY_TYPE,
            value: inquiryTypeId,
          });
        }

        const severityId = SEVERITY_OPTIONS[body.priority];
        if (severityId) {
          customFields.push({
            id: CLICKUP_FIELDS.SEVERITY_LEVEL,
            value: severityId,
          });
        }

        if (agentPhone) {
          customFields.push({
            id: CLICKUP_FIELDS.CLIENT_PHONE,
            value: agentPhone,
          });
        }

        const clickupPayload = {
          name: `[${body.category.toUpperCase()}] ${body.subject}`,
          description: buildEnhancedDescription(agentProfile, metrics, body),
          priority: priorityMap[body.priority] || 3,
          tags: [body.category, 'hub-portal'],
          assignees: config?.clickup_assignee_id ? [parseInt(config.clickup_assignee_id)] : [],
          custom_fields: customFields,
        };

        console.log('ClickUp payload created with enhanced description');

        const clickupResponse = await fetch(`https://api.clickup.com/api/v2/list/${clickupListId}/task`, {
          method: 'POST',
          headers: {
            'Authorization': clickupApiToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(clickupPayload),
        });

        if (clickupResponse.ok) {
          const clickupTask = await clickupResponse.json();
          clickupTaskId = clickupTask.id;
          console.log('ClickUp task created:', clickupTaskId, 'URL:', clickupTask.url);
        } else {
          const errorText = await clickupResponse.text();
          console.error('ClickUp API error:', clickupResponse.status, errorText);
        }
      } catch (clickupError) {
        console.error('Failed to create ClickUp task:', clickupError);
      }
    } else {
      console.log('ClickUp integration not configured (missing API token or list ID)');
    }

    // Save ticket to database
    const { data: ticket, error: insertError } = await supabase
      .from('support_tickets')
      .insert({
        agent_id: user.id,
        category: body.category,
        subject: body.subject,
        description: body.description,
        priority: body.priority,
        status: 'open',
        clickup_task_id: clickupTaskId,
        assigned_to: assignedTo,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create ticket', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Ticket created successfully:', ticket.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        ticket,
        clickup_synced: !!clickupTaskId,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error creating support ticket:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper function to find agent option ID by name (fuzzy match)
function findAgentOption(agentName: string): string | null {
  if (AGENT_OPTIONS[agentName]) {
    return AGENT_OPTIONS[agentName];
  }
  
  const normalizedName = agentName.toLowerCase().trim();
  for (const [name, id] of Object.entries(AGENT_OPTIONS)) {
    if (normalizedName.includes(name.toLowerCase()) || 
        name.toLowerCase().includes(normalizedName)) {
      return id;
    }
  }
  
  return null;
}

// Build enhanced description with agent profile and platform metrics
function buildEnhancedDescription(
  profile: AgentProfile | null,
  metrics: PlatformMetrics,
  ticket: TicketRequest
): string {
  const agentName = profile?.full_name || 
    (profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'Unknown Agent');
  
  const licenseStates = profile?.state_licenses || profile?.license_states || [];
  const statesDisplay = licenseStates.length > 0 ? licenseStates.join(', ') : 'Not specified';
  
  const completionRate = metrics.tasksThisWeek > 0 
    ? ((metrics.tasksCompleted / metrics.tasksThisWeek) * 100).toFixed(1) 
    : '0';

  let description = `## Agent Profile\n\n`;
  description += `**Name:** ${agentName}\n`;
  description += `**Email:** ${profile?.email || 'Not provided'}\n`;
  description += `**Phone:** ${formatPhone(profile?.phone_number)}\n`;
  description += `**Office:** ${formatPhone(profile?.office_number)}\n`;
  description += `**Brokerage:** ${profile?.brokerage || 'Not specified'}\n`;
  description += `**Team:** ${profile?.team_name || 'Not specified'}\n`;
  description += `**License:** ${profile?.license_number || 'Not provided'} (${statesDisplay})\n`;
  description += `**Office Address:** ${profile?.office_address || 'Not provided'}\n`;
  description += `**Website:** ${profile?.website || 'Not provided'}\n`;
  description += `**Member Since:** ${formatDate(profile?.created_at)}\n\n`;
  
  description += `---\n\n`;
  description += `## Platform Engagement\n\n`;
  description += `| Metric | Value |\n`;
  description += `|--------|-------|\n`;
  description += `| Database Size | ${metrics.databaseSize.toLocaleString()} contacts |\n`;
  description += `| Tasks This Week | ${metrics.tasksThisWeek} assigned |\n`;
  description += `| Tasks Completed | ${metrics.tasksCompleted} (${completionRate}%) |\n`;
  description += `| Scoreboard | ${metrics.scoreboardStatus} |\n`;
  description += `| Open Tickets | ${metrics.openTickets} other |\n`;
  description += `| Action Items | ${metrics.pendingActionItems} pending |\n\n`;
  
  description += `---\n\n`;
  description += `## Ticket Information\n\n`;
  description += `**Category:** ${ticket.category.charAt(0).toUpperCase() + ticket.category.slice(1)}\n`;
  description += `**Priority:** ${ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}\n\n`;
  
  description += `---\n\n`;
  description += `## Issue Description\n\n`;
  description += ticket.description || 'No additional details provided.';
  description += `\n\n---\n\n*Submitted via Hub Agent Support Portal*`;
  
  return description;
}
