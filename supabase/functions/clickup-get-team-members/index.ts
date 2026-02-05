import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const clickupApiToken = Deno.env.get('CLICKUP_API_TOKEN');
    
    if (!clickupApiToken) {
      return new Response(
        JSON.stringify({ error: 'CLICKUP_API_TOKEN not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // First, get the authorized teams/workspaces
    console.log('Fetching ClickUp teams...');
    const teamsResponse = await fetch('https://api.clickup.com/api/v2/team', {
      headers: {
        'Authorization': clickupApiToken,
        'Content-Type': 'application/json',
      },
    });

    if (!teamsResponse.ok) {
      const errorText = await teamsResponse.text();
      console.error('Failed to fetch teams:', teamsResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch ClickUp teams', details: errorText }),
        { status: teamsResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const teamsData = await teamsResponse.json();
    console.log('Teams found:', teamsData.teams?.length || 0);

    // Extract all members from all teams
    const allMembers: Array<{
      id: number;
      username: string;
      email: string;
      color: string;
      team_id: string;
      team_name: string;
    }> = [];

    for (const team of teamsData.teams || []) {
      console.log(`Processing team: ${team.name} (ID: ${team.id})`);
      
      for (const member of team.members || []) {
        allMembers.push({
          id: member.user.id,
          username: member.user.username,
          email: member.user.email,
          color: member.user.color,
          team_id: team.id,
          team_name: team.name,
        });
      }
    }

    console.log('Total members found:', allMembers.length);

    // Remove duplicates (same user in multiple teams)
    const uniqueMembers = Array.from(
      new Map(allMembers.map(m => [m.id, m])).values()
    );

    return new Response(
      JSON.stringify({
        success: true,
        teams: teamsData.teams?.map((t: any) => ({ id: t.id, name: t.name })) || [],
        members: uniqueMembers,
        total_members: uniqueMembers.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching ClickUp team members:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
