import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
    const supportListId = Deno.env.get('CLICKUP_SUPPORT_LIST_ID');

    if (!clickupApiToken) {
      return new Response(
        JSON.stringify({ error: 'CLICKUP_API_TOKEN not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!supportListId) {
      return new Response(
        JSON.stringify({ error: 'CLICKUP_SUPPORT_LIST_ID not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if webhook already exists for this list
    const { data: existingWebhook, error: fetchError } = await supabase
      .from('clickup_webhooks')
      .select('*')
      .eq('list_id', supportListId)
      .is('event_id', null)
      .maybeSingle();

    if (fetchError) {
      console.error('Error checking existing webhook:', fetchError);
    }

    if (existingWebhook?.webhook_id && existingWebhook?.active) {
      console.log('Webhook already registered:', existingWebhook.webhook_id);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Webhook already registered',
          webhook_id: existingWebhook.webhook_id,
          already_exists: true
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // First, get the team ID from the list
    console.log('Fetching list details for list_id:', supportListId);
    const listResponse = await fetch(`https://api.clickup.com/api/v2/list/${supportListId}`, {
      headers: {
        'Authorization': clickupApiToken,
        'Content-Type': 'application/json',
      },
    });

    if (!listResponse.ok) {
      const errorText = await listResponse.text();
      console.error('Failed to fetch list details:', listResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: `Failed to fetch list details: ${listResponse.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const listData = await listResponse.json();
    const teamId = listData.space?.team_id || listData.folder?.space?.team_id;

    if (!teamId) {
      console.error('Could not determine team ID from list:', listData);
      return new Response(
        JSON.stringify({ error: 'Could not determine team ID from list' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Found team ID:', teamId);

    // Register the webhook with ClickUp
    const webhookEndpoint = `${supabaseUrl}/functions/v1/support-ticket-webhook`;
    console.log('Registering webhook with endpoint:', webhookEndpoint);

    const webhookResponse = await fetch(`https://api.clickup.com/api/v2/team/${teamId}/webhook`, {
      method: 'POST',
      headers: {
        'Authorization': clickupApiToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        endpoint: webhookEndpoint,
        events: [
          'taskUpdated',
          'taskStatusUpdated',
          'taskAssigneeUpdated',
          'taskCommentPosted',
        ],
        list_id: supportListId,
      }),
    });

    const webhookResult = await webhookResponse.json();
    console.log('Webhook registration response:', webhookResult);

    if (!webhookResponse.ok) {
      console.error('Failed to register webhook:', webhookResult);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to register webhook with ClickUp',
          details: webhookResult 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const webhookId = webhookResult.id || webhookResult.webhook?.id;

    // Store webhook info in database
    const { error: insertError } = await supabase
      .from('clickup_webhooks')
      .upsert({
        list_id: supportListId,
        webhook_id: webhookId,
        team_id: teamId,
        active: true,
        event_id: null, // null indicates this is for support tickets, not events
        updated_at: new Date().toISOString(),
      }, { 
        onConflict: 'list_id',
        ignoreDuplicates: false 
      });

    if (insertError) {
      console.error('Failed to store webhook info:', insertError);
      // Don't fail the request, webhook is still registered
    }

    console.log('Webhook registered successfully:', webhookId);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Webhook registered successfully',
        webhook_id: webhookId,
        team_id: teamId,
        endpoint: webhookEndpoint,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error registering webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
