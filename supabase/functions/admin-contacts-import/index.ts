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

    // Check for duplicates before inserting
    console.log(`Checking for duplicates among ${contacts.length} contacts`);
    
    // Get all emails and phones from the CSV contacts
    const csvEmails = contacts.filter(c => c.email?.trim()).map(c => c.email.trim());
    const csvPhones = contacts.filter(c => c.phone?.trim()).map(c => c.phone.trim());
    
    console.log(`CSV contains ${csvEmails.length} emails and ${csvPhones.length} phones`);
    
    if (csvEmails.length > 0 || csvPhones.length > 0) {
      // Build OR conditions for all emails and phones
      const orConditions = [];
      
      // Add email conditions
      csvEmails.forEach(email => {
        orConditions.push(`email.eq.${email}`);
      });
      
      // Add phone conditions  
      csvPhones.forEach(phone => {
        orConditions.push(`phone.eq.${phone}`);
      });
      
      if (orConditions.length > 0) {
        console.log(`Checking ${orConditions.length} potential duplicates in database`);
        
        const { data: existingContacts, error: duplicateError } = await supabaseServiceRole
          .from('contacts')
          .select('id, email, phone, first_name, last_name')
          .eq('agent_id', agentId)
          .or(orConditions.join(','));
          
        if (duplicateError) {
          console.error('Error checking for duplicates:', duplicateError);
          throw new Error(`Failed to check for duplicates: ${duplicateError.message}`);
        }
        
        if (existingContacts && existingContacts.length > 0) {
          const duplicateInfo = existingContacts.map(d => {
            const name = `${d.first_name || ''} ${d.last_name || ''}`.trim() || 'Unknown';
            return `${name} (Email: ${d.email || 'N/A'}, Phone: ${d.phone || 'N/A'})`;
          }).join('; ');
          
          console.error('Duplicates found:', duplicateInfo);
          throw new Error(`Duplicate contacts found: ${duplicateInfo}. Please remove these duplicates from your CSV and try again.`);
        }
      }
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

    // Note: DNC checks are now handled by monthly automation only

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully imported ${insertedContacts?.length || 0} contacts for agent ${targetAgent.first_name} ${targetAgent.last_name}`,
        contactCount: insertedContacts?.length || 0
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