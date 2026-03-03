import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Missing authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Create client with caller's auth context
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);

    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub;

    // Check admin role via RPC
    const { data: userRole, error: roleError } = await supabaseAuth.rpc('get_current_user_role');

    if (roleError || userRole !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { agentId } = await req.json();

    if (!agentId) {
      return new Response(
        JSON.stringify({ error: 'Missing agentId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Admin ${userId} starting duplicate cleanup for agent ${agentId}`);

    // Use service role for data operations
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Get all contacts for the agent
    const { data: contacts, error: fetchError } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, email, phone, created_at')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false });

    if (fetchError) throw fetchError;

    console.log(`Found ${contacts?.length || 0} total contacts for agent`);

    if (!contacts || contacts.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'No contacts found for the specified agent',
          duplicatesRemoved: 0,
          remainingContacts: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Group contacts by unique identifier
    const contactGroups = new Map();
    
    contacts.forEach(contact => {
      const key = `${(contact.first_name || '').toLowerCase().trim()}_${(contact.last_name || '').toLowerCase().trim()}_${(contact.email || '').toLowerCase().trim()}_${(contact.phone || '').trim()}`;
      
      if (!contactGroups.has(key)) {
        contactGroups.set(key, []);
      }
      contactGroups.get(key).push(contact);
    });

    // Collect IDs of duplicates to delete (keep the most recent)
    const duplicateIds: string[] = [];
    let uniqueContacts = 0;

    contactGroups.forEach((group) => {
      if (group.length > 1) {
        group.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        for (let i = 1; i < group.length; i++) {
          duplicateIds.push(group[i].id);
        }
      }
      uniqueContacts++;
    });

    console.log(`Identified ${duplicateIds.length} duplicates to remove, keeping ${uniqueContacts} unique contacts`);

    let deletedCount = 0;

    if (duplicateIds.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < duplicateIds.length; i += batchSize) {
        const batch = duplicateIds.slice(i, i + batchSize);
        const { error: deleteError } = await supabase
          .from('contacts')
          .delete()
          .in('id', batch);

        if (deleteError) throw deleteError;
        deletedCount += batch.length;
      }
    }

    console.log(`Cleanup completed: ${deletedCount} duplicates removed, ${uniqueContacts} unique contacts remain`);

    return new Response(
      JSON.stringify({
        message: 'Duplicate cleanup completed successfully',
        duplicatesRemoved: deletedCount,
        remainingContacts: uniqueContacts,
        originalTotal: contacts.length
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Cleanup error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to clean up duplicates' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
