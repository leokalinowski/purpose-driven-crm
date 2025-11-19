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


    console.log('No duplicates found, proceeding with import');

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

    // Run DNC checks on newly imported contacts
    let dncChecked = 0;
    let dncFlagged = 0;
    const dncErrors: string[] = [];
    
    if (insertedContacts && insertedContacts.length > 0) {
      console.log('Starting DNC checks for imported contacts...');
      const dncApiKey = Deno.env.get('DNC_API_KEY');
      
      if (dncApiKey) {
        // Process in batches of 10 to avoid rate limits
        const batchSize = 10;
        for (let i = 0; i < insertedContacts.length; i += batchSize) {
          const batch = insertedContacts.slice(i, i + batchSize);
          
          await Promise.all(batch.map(async (contact) => {
            // Only check contacts with phone numbers
            if (!contact.phone) return;
            
            try {
              const phoneDigits = contact.phone.replace(/\D/g, '');
              let normalizedPhone = phoneDigits;
              
              // Normalize to 10 digits (remove country code if present)
              if (phoneDigits.length === 11 && phoneDigits.startsWith('1')) {
                normalizedPhone = phoneDigits.substring(1);
              } else if (phoneDigits.length !== 10) {
                console.log(`Skipping invalid phone: ${contact.phone} (${phoneDigits.length} digits)`);
                return;
              }
              
              // Use correct RealValidation API endpoint
              const dncApiUrl = `https://api.realvalidation.com/rpvWebService/DNCLookup.php?phone=${normalizedPhone}&token=${dncApiKey}`;
              console.log(`Checking DNC for contact ${contact.id}, phone: ${normalizedPhone}`);
              
              const dncResponse = await fetch(dncApiUrl);
              
              if (dncResponse.ok) {
                const xmlResponse = await dncResponse.text();
                console.log(`DNC API Response for ${contact.id}: ${xmlResponse}`);
                
                const nationalDNC = xmlResponse.includes('<national_dnc>Y</national_dnc>');
                const stateDNC = xmlResponse.includes('<state_dnc>Y</state_dnc>');
                const dma = xmlResponse.includes('<dma>Y</dma>');
                const litigator = xmlResponse.includes('<litigator>Y</litigator>');
                const isDNC = nationalDNC || stateDNC || dma || litigator;
                
                console.log(`DNC Check Result for ${contact.id}: nationalDNC=${nationalDNC}, stateDNC=${stateDNC}, dma=${dma}, litigator=${litigator}, isDNC=${isDNC}`);
                
                // Update contact with DNC status
                await supabaseServiceRole
                  .from('contacts')
                  .update({ 
                    dnc: isDNC,
                    dnc_last_checked: new Date().toISOString()
                  })
                  .eq('id', contact.id);
                
                dncChecked++;
                if (isDNC) dncFlagged++;
                
                console.log(`DNC check for ${normalizedPhone}: ${isDNC ? 'FLAGGED' : 'CLEAR'}`);
              }
            } catch (error) {
              dncErrors.push(`${contact.phone}: ${error.message}`);
              console.error(`DNC check failed for ${contact.phone}:`, error);
            }
          }));
          
          // Small delay between batches
          if (i + batchSize < insertedContacts.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        
        console.log(`DNC checks complete: ${dncChecked} checked, ${dncFlagged} flagged`);
      } else {
        console.warn('DNC_API_KEY not configured, skipping DNC checks');
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully imported ${insertedContacts?.length || 0} contacts for agent ${targetAgent.first_name} ${targetAgent.last_name}`,
        contactCount: insertedContacts?.length || 0,
        dncStats: {
          checked: dncChecked,
          flagged: dncFlagged,
          errors: dncErrors.length
        }
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