import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { agentId, adminUserId } = await req.json();

    if (!agentId || !adminUserId) {
      return new Response(
        JSON.stringify({ error: 'Missing agentId or adminUserId' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Verify admin role
    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', adminUserId)
      .single();

    if (adminProfile?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Admin access required' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Starting duplicate cleanup for agent ${agentId}`);

    // Get all contacts for the agent
    const { data: contacts, error: fetchError } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, email, phone, created_at')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false });

    if (fetchError) {
      throw fetchError;
    }

    console.log(`Found ${contacts?.length || 0} total contacts for agent`);

    if (!contacts || contacts.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'No contacts found for the specified agent',
          duplicatesRemoved: 0,
          remainingContacts: 0
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Group contacts by unique identifier (combination of name, email, phone)
    const contactGroups = new Map();
    
    contacts.forEach(contact => {
      const key = `${(contact.first_name || '').toLowerCase().trim()}_${(contact.last_name || '').toLowerCase().trim()}_${(contact.email || '').toLowerCase().trim()}_${(contact.phone || '').trim()}`;
      
      if (!contactGroups.has(key)) {
        contactGroups.set(key, []);
      }
      contactGroups.get(key).push(contact);
    });

    console.log(`Found ${contactGroups.size} unique contact groups`);

    // Collect IDs of duplicates to delete (keep the most recent one in each group)
    const duplicateIds: string[] = [];
    let uniqueContacts = 0;

    contactGroups.forEach((group) => {
      if (group.length > 1) {
        // Sort by created_at descending, keep the first (most recent), mark others for deletion
        group.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        
        // Add all but the first to the delete list
        for (let i = 1; i < group.length; i++) {
          duplicateIds.push(group[i].id);
        }
      }
      uniqueContacts++;
    });

    console.log(`Identified ${duplicateIds.length} duplicates to remove, keeping ${uniqueContacts} unique contacts`);

    let deletedCount = 0;

    // Delete duplicates in batches
    if (duplicateIds.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < duplicateIds.length; i += batchSize) {
        const batch = duplicateIds.slice(i, i + batchSize);
        
        const { error: deleteError } = await supabase
          .from('contacts')
          .delete()
          .in('id', batch);

        if (deleteError) {
          console.error(`Error deleting batch ${i / batchSize + 1}:`, deleteError);
          throw deleteError;
        }

        deletedCount += batch.length;
        console.log(`Deleted batch ${i / batchSize + 1}: ${batch.length} contacts`);
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
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('Cleanup error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to clean up duplicates' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
