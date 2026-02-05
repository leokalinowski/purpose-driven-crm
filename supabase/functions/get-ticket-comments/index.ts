import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

interface ClickUpComment {
  id: string;
  comment_text: string;
  user: {
    id: number;
    username: string;
    email: string;
    profilePicture?: string;
  };
  date: string;
}

interface FormattedComment {
  id: string;
  text: string;
  author: string;
  author_email: string;
  created_at: string;
  is_admin: boolean;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const ticketId = url.searchParams.get('ticket_id');

    if (!ticketId) {
      return new Response(
        JSON.stringify({ error: 'ticket_id is required' }),
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
      .select('id, agent_id, clickup_task_id')
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      console.error('Ticket not found:', ticketError);
      return new Response(
        JSON.stringify({ error: 'Ticket not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is the ticket owner or an admin
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    const isAdmin = userRole?.role === 'admin';
    const isOwner = ticket.agent_id === user.id;

    if (!isOwner && !isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If no ClickUp task ID, return empty comments
    if (!ticket.clickup_task_id) {
      console.log('No ClickUp task ID for ticket:', ticketId);
      return new Response(
        JSON.stringify({ comments: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get agent's email to determine which comments are from them
    const { data: agentProfile } = await supabase
      .from('profiles')
      .select('email')
      .eq('user_id', ticket.agent_id)
      .single();

    const agentEmail = agentProfile?.email?.toLowerCase();

    // Fetch comments from ClickUp
    const clickupToken = Deno.env.get('CLICKUP_API_TOKEN');
    if (!clickupToken) {
      console.error('CLICKUP_API_TOKEN not configured');
      return new Response(
        JSON.stringify({ error: 'ClickUp integration not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching comments for ClickUp task:', ticket.clickup_task_id);

    const clickupResponse = await fetch(
      `https://api.clickup.com/api/v2/task/${ticket.clickup_task_id}/comment`,
      {
        headers: {
          'Authorization': clickupToken,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!clickupResponse.ok) {
      const errorText = await clickupResponse.text();
      console.error('ClickUp API error:', clickupResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch comments from ClickUp' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const clickupData = await clickupResponse.json();
    const comments: ClickUpComment[] = clickupData.comments || [];

    console.log(`Fetched ${comments.length} comments from ClickUp`);

    // Format comments for the frontend
    const formattedComments: FormattedComment[] = comments.map((comment) => {
      const commentEmail = comment.user?.email?.toLowerCase();
      // If the comment is from the agent's email, it's not an admin comment
      const is_admin = agentEmail ? commentEmail !== agentEmail : true;

      return {
        id: comment.id,
        text: comment.comment_text,
        author: comment.user?.username || 'Unknown',
        author_email: comment.user?.email || '',
        created_at: new Date(parseInt(comment.date)).toISOString(),
        is_admin,
      };
    });

    // Sort by date ascending (oldest first)
    formattedComments.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    return new Response(
      JSON.stringify({ comments: formattedComments }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-ticket-comments:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
