import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    const { ticket_id, message } = await req.json();

    if (!ticket_id || !message) {
      return new Response(
        JSON.stringify({ error: 'ticket_id and message are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get ticket and verify ownership
    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .select('id, agent_id, clickup_task_id, subject')
      .eq('id', ticket_id)
      .single();

    if (ticketError || !ticket) {
      console.error('Ticket not found:', ticketError);
      return new Response(
        JSON.stringify({ error: 'Ticket not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user owns this ticket
    if (ticket.agent_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Access denied - you can only comment on your own tickets' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if ticket has a ClickUp task
    if (!ticket.clickup_task_id) {
      console.error('No ClickUp task ID for ticket:', ticket_id);
      return new Response(
        JSON.stringify({ error: 'This ticket is not synced with ClickUp' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's profile for the comment attribution
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name, email')
      .eq('user_id', user.id)
      .single();

    const userName = profile 
      ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email
      : user.email;

    // Post comment to ClickUp
    const clickupToken = Deno.env.get('CLICKUP_API_TOKEN');
    if (!clickupToken) {
      console.error('CLICKUP_API_TOKEN not configured');
      return new Response(
        JSON.stringify({ error: 'ClickUp integration not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format the comment with user attribution
    const formattedComment = `**${userName}** via Hub Portal:\n\n${message}`;

    console.log('Posting comment to ClickUp task:', ticket.clickup_task_id);

    const clickupResponse = await fetch(
      `https://api.clickup.com/api/v2/task/${ticket.clickup_task_id}/comment`,
      {
        method: 'POST',
        headers: {
          'Authorization': clickupToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          comment_text: formattedComment,
        }),
      }
    );

    if (!clickupResponse.ok) {
      const errorText = await clickupResponse.text();
      console.error('ClickUp API error:', clickupResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to post comment to ClickUp' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const clickupData = await clickupResponse.json();
    console.log('Comment posted successfully:', clickupData.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        comment_id: clickupData.id,
        message: 'Comment posted successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in post-ticket-comment:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
