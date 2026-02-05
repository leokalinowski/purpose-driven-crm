import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

interface ActionItemDefinition {
  item_type: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  action_url: string;
}

const ACTION_ITEM_DEFINITIONS: ActionItemDefinition[] = [
  {
    item_type: 'no_contacts',
    priority: 'high',
    title: 'Upload your contacts to get started',
    description: 'SphereSync needs contacts to generate your weekly outreach tasks. Upload your database to begin.',
    action_url: '/database',
  },
  {
    item_type: 'no_metricool',
    priority: 'medium',
    title: 'Connect your social media accounts',
    description: 'Link Metricool to track your social media performance and schedule posts.',
    action_url: '/social-scheduler',
  },
  {
    item_type: 'no_coaching',
    priority: 'low',
    title: 'Submit your weekly coaching numbers',
    description: "Track your progress by submitting this week's activity metrics.",
    action_url: '/coaching',
  },
  {
    item_type: 'incomplete_profile',
    priority: 'low',
    title: 'Complete your agent profile',
    description: 'Add your headshot and contact information to personalize your marketing materials.',
    action_url: '/admin/team-management',
  },
];

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get optional agent_id filter from request body
    let targetAgentId: string | null = null;
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        targetAgentId = body.agent_id || null;
      } catch {
        // No body or invalid JSON, process all agents
      }
    }

    console.log('Generating action items', targetAgentId ? `for agent: ${targetAgentId}` : 'for all agents');

    // Get all active agents (or specific agent)
    let profilesQuery = supabase
      .from('profiles')
      .select('user_id, first_name, last_name, headshot_url, phone_number, created_at');
    
    if (targetAgentId) {
      profilesQuery = profilesQuery.eq('user_id', targetAgentId);
    }

    const { data: profiles, error: profilesError } = await profilesQuery;

    if (profilesError) {
      console.error('Failed to fetch profiles:', profilesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch profiles' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let itemsCreated = 0;
    let itemsResolved = 0;

    for (const profile of profiles || []) {
      const agentId = profile.user_id;
      console.log(`Processing agent: ${profile.first_name} ${profile.last_name} (${agentId})`);

      // Check each condition and create/resolve action items

      // 1. No contacts check
      const { count: contactCount } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', agentId);

      await processActionItem(supabase, agentId, 'no_contacts', (contactCount || 0) === 0);
      if ((contactCount || 0) === 0) itemsCreated++; else itemsResolved++;

      // 2. No Metricool check
      const { data: metricoolLink } = await supabase
        .from('metricool_links')
        .select('is_active')
        .eq('user_id', agentId)
        .eq('is_active', true)
        .maybeSingle();

      await processActionItem(supabase, agentId, 'no_metricool', !metricoolLink);
      if (!metricoolLink) itemsCreated++; else itemsResolved++;

      // 3. No coaching submission this week
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const { count: recentCoaching } = await supabase
        .from('coaching_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', agentId)
        .gte('created_at', oneWeekAgo.toISOString());

      await processActionItem(supabase, agentId, 'no_coaching', (recentCoaching || 0) === 0);
      if ((recentCoaching || 0) === 0) itemsCreated++; else itemsResolved++;

      // 4. Incomplete profile check (missing headshot or phone)
      const isProfileIncomplete = !profile.headshot_url || !profile.phone_number;
      await processActionItem(supabase, agentId, 'incomplete_profile', isProfileIncomplete);
      if (isProfileIncomplete) itemsCreated++; else itemsResolved++;
    }

    console.log(`Action items generation complete. Created/active: ${itemsCreated}, Resolved: ${itemsResolved}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        agents_processed: profiles?.length || 0,
        items_created: itemsCreated,
        items_resolved: itemsResolved,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating action items:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function processActionItem(
  supabase: ReturnType<typeof createClient>,
  agentId: string,
  itemType: string,
  conditionMet: boolean
) {
  const definition = ACTION_ITEM_DEFINITIONS.find(d => d.item_type === itemType);
  if (!definition) return;

  // Check if action item already exists
  const { data: existing } = await supabase
    .from('agent_action_items')
    .select('id, resolved_at')
    .eq('agent_id', agentId)
    .eq('item_type', itemType)
    .maybeSingle();

  if (conditionMet) {
    // Create or reactivate action item
    if (!existing) {
      // Create new
      await supabase.from('agent_action_items').insert({
        agent_id: agentId,
        item_type: definition.item_type,
        priority: definition.priority,
        title: definition.title,
        description: definition.description,
        action_url: definition.action_url,
      });
      console.log(`Created action item: ${itemType} for agent ${agentId}`);
    } else if (existing.resolved_at) {
      // Reactivate if it was resolved
      await supabase
        .from('agent_action_items')
        .update({ resolved_at: null, is_dismissed: false, dismissed_until: null })
        .eq('id', existing.id);
      console.log(`Reactivated action item: ${itemType} for agent ${agentId}`);
    }
  } else {
    // Resolve action item if condition is no longer met
    if (existing && !existing.resolved_at) {
      await supabase
        .from('agent_action_items')
        .update({ resolved_at: new Date().toISOString() })
        .eq('id', existing.id);
      console.log(`Resolved action item: ${itemType} for agent ${agentId}`);
    }
  }
}
