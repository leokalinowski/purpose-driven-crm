import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ContactInput {
  first_name?: string;
  last_name: string;
  phone?: string;
  email?: string;
  address_1?: string;
  address_2?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  tags?: string[] | null;
  dnc?: boolean;
  notes?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Admin contacts import started');
    
    // Initialize Supabase client with service role key
    const supabaseServiceRole = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse request body
    const { contacts, agentId, adminUserId } = await req.json();

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      throw new Error('No contacts provided');
    }

    if (!agentId) {
      throw new Error('Agent ID is required');
    }

    if (!adminUserId) {
      throw new Error('Admin user ID is required');
    }

    console.log(`Processing ${contacts.length} contacts for agent ${agentId} (by admin ${adminUserId})`);

    // Verify the requesting user is an admin
    const { data: adminProfile, error: adminError } = await supabaseServiceRole
      .from('profiles')
      .select('role')
      .eq('user_id', adminUserId)
      .single();

    if (adminError || !adminProfile || adminProfile.role !== 'admin') {
      console.error('Admin verification failed:', adminError);
      throw new Error('Unauthorized: Only admins can perform bulk imports');
    }

    // Verify the target agent exists
    const { data: targetAgent, error: agentError } = await supabaseServiceRole
      .from('profiles')
      .select('user_id, first_name, last_name')
      .eq('user_id', agentId)
      .single();

    if (agentError || !targetAgent) {
      console.error('Target agent verification failed:', agentError);
      throw new Error('Target agent not found');
    }

    // Prepare contacts for insertion
    const contactsForDb = contacts.map((contact: ContactInput) => ({
      ...contact,
      agent_id: agentId,
      category: contact.last_name?.charAt(0)?.toUpperCase() || 'U',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    // Insert contacts using service role (bypasses RLS)
    const { data: insertedContacts, error: insertError } = await supabaseServiceRole
      .from('contacts')
      .insert(contactsForDb)
      .select();

    if (insertError) {
      console.error('Contact insertion failed:', insertError);
      throw new Error(`Failed to insert contacts: ${insertError.message}`);
    }

    console.log(`Successfully inserted ${insertedContacts?.length || 0} contacts`);

    // Automatically initiate DNC checks for contacts with phone numbers
    const contactsWithPhones = insertedContacts?.filter(contact => 
      contact.phone && contact.phone.trim() !== ''
    ) || [];

    if (contactsWithPhones.length > 0) {
      console.log(`Initiating DNC checks for ${contactsWithPhones.length} contacts with phone numbers`);
      
      try {
        // Call the DNC check function for each contact
        const dncPromises = contactsWithPhones.map(contact => 
          supabaseServiceRole.functions.invoke('dnc-single-check', {
            body: { contactId: contact.id }
          })
        );

        await Promise.all(dncPromises);
        console.log('DNC checks initiated successfully');
      } catch (dncError) {
        console.error('DNC check initiation failed:', dncError);
        // Don't fail the entire operation for DNC check failures
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully imported ${insertedContacts?.length || 0} contacts for agent ${targetAgent.first_name} ${targetAgent.last_name}`,
        contactCount: insertedContacts?.length || 0,
        dncChecksInitiated: contactsWithPhones.length
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Admin contacts import error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to import contacts'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});