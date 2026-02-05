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

serve(async (req) => {
  // Handle CORS preflight
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

    // Validate required fields
    if (!body.category || !body.subject || !body.priority) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: category, subject, priority' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get agent profile for context
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name, email')
      .eq('user_id', user.id)
      .single();

    const agentName = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'Unknown Agent';
    const agentEmail = profile?.email || user.email || 'unknown';

    // Get support config for assignee
    const { data: config } = await supabase
      .from('support_config')
      .select('clickup_assignee_id, assignee_name')
      .eq('category', body.category)
      .single();

    let clickupTaskId: string | null = null;
    let assignedTo: string | null = config?.assignee_name || null;

    // Create ClickUp task if API token is configured
    // NOTE: You'll need to set CLICKUP_SUPPORT_LIST_ID in secrets
    const clickupListId = Deno.env.get('CLICKUP_SUPPORT_LIST_ID');
    
    if (clickupApiToken && clickupListId) {
      try {
        console.log('Creating ClickUp task in list:', clickupListId);
        
        const priorityMap: Record<string, number> = {
          'high': 1,    // Urgent in ClickUp
          'medium': 2,  // High in ClickUp
          'low': 3,     // Normal in ClickUp
        };

        const clickupPayload = {
          name: `[${body.category.toUpperCase()}] ${body.subject}`,
          description: `**Agent:** ${agentName} (${agentEmail})\n\n**Category:** ${body.category}\n**Priority:** ${body.priority}\n\n**Details:**\n${body.description || 'No additional details provided.'}`,
          priority: priorityMap[body.priority] || 3,
          tags: [body.category],
          assignees: config?.clickup_assignee_id ? [parseInt(config.clickup_assignee_id)] : [],
        };

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
          console.log('ClickUp task created:', clickupTaskId);
        } else {
          const errorText = await clickupResponse.text();
          console.error('ClickUp API error:', clickupResponse.status, errorText);
        }
      } catch (clickupError) {
        console.error('Failed to create ClickUp task:', clickupError);
        // Continue without ClickUp - ticket will still be saved locally
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
