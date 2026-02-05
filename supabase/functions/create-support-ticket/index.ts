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
  'general': '3a45e9fd-9d11-49f6-ad71-c8e78e9653d7',    // General Inquiry
  'database': 'd54ab778-c6f7-4f54-a1aa-087ca7ebd962',   // Support Request
  'social': 'd54ab778-c6f7-4f54-a1aa-087ca7ebd962',     // Support Request
  'events': 'd54ab778-c6f7-4f54-a1aa-087ca7ebd962',     // Support Request
  'newsletter': 'd54ab778-c6f7-4f54-a1aa-087ca7ebd962', // Support Request
  'spheresync': 'd54ab778-c6f7-4f54-a1aa-087ca7ebd962', // Support Request
  'technical': 'd54ab778-c6f7-4f54-a1aa-087ca7ebd962',  // Support Request
  'coaching': '0f1f6aac-1a12-4a15-9daa-b3b3f23b3cf7',   // Feedback
};

// Map priority to ClickUp severity dropdown option IDs
const SEVERITY_OPTIONS: Record<string, string> = {
  'high': '7616aa5e-cfc5-4303-bbd8-e2aaac0b156e',    // High
  'medium': '8a6d08e0-d273-4757-8078-05c7c7cc354f',  // Medium
  'low': '3e54e01d-8d4a-4549-b24b-21b4b2719b35',     // Low
};

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
      .select('first_name, last_name, email, phone_number, full_name')
      .eq('user_id', user.id)
      .single();

    const agentName = profile?.full_name || 
      (profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'Unknown Agent');
    const agentEmail = profile?.email || user.email || 'unknown';
    const agentPhone = profile?.phone_number || '';

    console.log('Agent info:', { agentName, agentEmail, agentPhone });

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
        
        // Map priority to ClickUp priority (1=Urgent, 2=High, 3=Normal, 4=Low)
        const priorityMap: Record<string, number> = {
          'high': 2,
          'medium': 3,
          'low': 4,
        };

        // Build custom fields array
        const customFields: Array<{ id: string; value: any }> = [];

        // Set Agent dropdown if we can match the name
        const agentOptionId = findAgentOption(agentName);
        if (agentOptionId) {
          customFields.push({
            id: CLICKUP_FIELDS.AGENT,
            value: agentOptionId,
          });
          console.log('Mapped agent to dropdown:', agentName, '->', agentOptionId);
        }

        // Set Inquiry Type based on category
        const inquiryTypeId = INQUIRY_TYPE_OPTIONS[body.category];
        if (inquiryTypeId) {
          customFields.push({
            id: CLICKUP_FIELDS.INQUIRY_TYPE,
            value: inquiryTypeId,
          });
          console.log('Mapped category to inquiry type:', body.category, '->', inquiryTypeId);
        }

        // Set Severity Level based on priority
        const severityId = SEVERITY_OPTIONS[body.priority];
        if (severityId) {
          customFields.push({
            id: CLICKUP_FIELDS.SEVERITY_LEVEL,
            value: severityId,
          });
          console.log('Mapped priority to severity:', body.priority, '->', severityId);
        }

        // Set phone number if available
        if (agentPhone) {
          customFields.push({
            id: CLICKUP_FIELDS.CLIENT_PHONE,
            value: agentPhone,
          });
          console.log('Set phone number:', agentPhone);
        }

        const clickupPayload = {
          name: `[${body.category.toUpperCase()}] ${body.subject}`,
          description: buildDescription(agentName, agentEmail, agentPhone, body.category, body.priority, body.description),
          priority: priorityMap[body.priority] || 3,
          tags: [body.category, 'hub-portal'],
          assignees: config?.clickup_assignee_id ? [parseInt(config.clickup_assignee_id)] : [],
          custom_fields: customFields,
        };

        console.log('ClickUp payload:', JSON.stringify(clickupPayload, null, 2));

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

// Helper function to find agent option ID by name (fuzzy match)
function findAgentOption(agentName: string): string | null {
  // Direct match
  if (AGENT_OPTIONS[agentName]) {
    return AGENT_OPTIONS[agentName];
  }
  
  // Try to find partial match
  const normalizedName = agentName.toLowerCase().trim();
  for (const [name, id] of Object.entries(AGENT_OPTIONS)) {
    if (normalizedName.includes(name.toLowerCase()) || 
        name.toLowerCase().includes(normalizedName)) {
      return id;
    }
  }
  
  return null;
}

// Helper function to build rich description
function buildDescription(
  agentName: string, 
  agentEmail: string, 
  agentPhone: string,
  category: string,
  priority: string,
  details?: string
): string {
  let description = `### Ticket Details\n\n`;
  description += `**Agent:** ${agentName}\n`;
  description += `**Email:** ${agentEmail}\n`;
  if (agentPhone) {
    description += `**Phone:** ${agentPhone}\n`;
  }
  description += `**Category:** ${category}\n`;
  description += `**Priority:** ${priority}\n\n`;
  description += `---\n\n`;
  description += `### Description\n\n`;
  description += details || 'No additional details provided.';
  description += `\n\n---\n*Submitted via Hub Agent Support Portal*`;
  
  return description;
}
