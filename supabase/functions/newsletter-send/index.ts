import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Resend } from 'npm:resend@4.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NewsletterRequest {
  agent_id: string;
  dry_run: boolean;
}

interface Contact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  zip_code: string;
  address_1: string | null;
  address_2: string | null;
  city: string | null;
  state: string | null;
}

interface AgentProfile {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface EmailData {
  zip_code: string;
  html_email: string;
}


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { agent_id, dry_run }: NewsletterRequest = await req.json();
    
    console.log(`Starting newsletter ${dry_run ? 'test' : 'send'} for agent: ${agent_id}`);

    // Initialize Supabase and Resend clients
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

    // Create a new run record
    const { data: runRecord, error: runError } = await supabase
      .from('monthly_runs')
      .insert({
        agent_id,
        dry_run,
        status: 'running',
        run_date: new Date().toISOString().split('T')[0]
      })
      .select()
      .single();

    if (runError) {
      console.error('Error creating run record:', runError);
      throw new Error('Failed to create run record');
    }

    try {
      // Get agent profile
      const { data: agent, error: agentError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email')
        .eq('user_id', agent_id)
        .single();

      if (agentError || !agent) {
        throw new Error('Agent not found');
      }

      console.log(`Found agent: ${agent.first_name} ${agent.last_name}`);

      // Get agent's contacts with valid email, zip_code, and address
      const { data: contacts, error: contactsError } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, email, zip_code, address_1, address_2, city, state')
        .eq('agent_id', agent_id)
        .not('email', 'is', null)
        .not('zip_code', 'is', null)
        .neq('email', '')
        .neq('zip_code', '');

      if (contactsError) {
        throw new Error(`Failed to fetch contacts: ${contactsError.message}`);
      }

      console.log(`Found ${contacts?.length || 0} contacts with valid email and zip`);

      if (!contacts || contacts.length === 0) {
        throw new Error('No contacts found with valid email and ZIP code');
      }

      // Filter out invalid zip codes and get unique ZIP codes
      const validContacts = contacts.filter(contact => {
        const zip = contact.zip_code?.replace(/[^0-9]/g, '');
        return zip && zip.length === 5;
      });

      if (validContacts.length === 0) {
        throw new Error('No contacts with valid 5-digit ZIP codes');
      }

      const uniqueZipCodes = [...new Set(validContacts.map(c => c.zip_code))];
      console.log(`Processing ${uniqueZipCodes.length} unique ZIP codes`);

      // For test mode, only process first ZIP code
      const zipsToProcess = dry_run ? [uniqueZipCodes[0]] : uniqueZipCodes;
      
      let totalEmailsSent = 0;
      let totalContactsProcessed = 0;

      for (const zipCode of zipsToProcess) {
        console.log(`Processing ZIP code: ${zipCode}`);
        
        // Get contacts for this ZIP
        const zipContacts = validContacts.filter(c => c.zip_code === zipCode);
        console.log(`Found ${zipContacts.length} contacts for ZIP ${zipCode}`);

        // Generate and send emails for each contact
        for (const contact of zipContacts) {
          if (!contact.email) continue;

          // Build address string
          const addressParts = [
            contact.address_1,
            contact.address_2,
            contact.city,
            contact.state
          ].filter(Boolean);
          const address = addressParts.length > 0 ? addressParts.join(', ') : `ZIP ${contact.zip_code}`;

          // Get personalized market data/email for this contact
          const { data: emailData, error: emailError } = await supabase.functions.invoke('market-data-grok', {
            body: {
              zip_code: zipCode,
              first_name: contact.first_name || '',
              last_name: contact.last_name || '',
              email: contact.email,
              address: address,
              agent_name: `${agent.first_name || ''} ${agent.last_name || ''}`.trim(),
              agent_info: `${agent.first_name || ''} ${agent.last_name || ''}, Real Estate Agent, Email: ${agent.email || ''}`
            }
          });

          if (emailError) {
            console.error(`Failed to get email data for contact ${contact.email}:`, emailError);
            continue;
          }

          const subject = dry_run 
            ? `[TEST] Your ${zipCode} Market Report - ${new Date().toLocaleDateString()}`
            : `Your ${zipCode} Market Report - ${new Date().toLocaleDateString()}`;
          
          const toEmail = dry_run ? agent.email! : contact.email;
          const fromName = `${agent.first_name || ''} ${agent.last_name || ''}`.trim() || 'Your Real Estate Agent';

          try {
            await resend.emails.send({
              from: `${fromName} <${Deno.env.get('RESEND_FROM_EMAIL')}>`,
              to: [toEmail],
              subject,
              html: emailData.html_email,
            });

            totalEmailsSent++;
            totalContactsProcessed++;
            
            console.log(`Email sent to ${dry_run ? 'agent (test mode)' : contact.email}`);
            
            // In test mode, only send one email
            if (dry_run) break;
          } catch (emailError) {
            console.error(`Failed to send email to ${contact.email}:`, emailError);
          }
        }

        // In test mode, only process one ZIP
        if (dry_run) break;
      }

      // Update run record with results
      await supabase
        .from('monthly_runs')
        .update({
          status: 'completed',
          emails_sent: totalEmailsSent,
          contacts_processed: totalContactsProcessed,
          zip_codes_processed: zipsToProcess.length,
          finished_at: new Date().toISOString()
        })
        .eq('id', runRecord.id);

      console.log(`Newsletter ${dry_run ? 'test' : 'send'} completed. Emails sent: ${totalEmailsSent}`);

      return new Response(JSON.stringify({
        success: true,
        emails_sent: totalEmailsSent,
        contacts_processed: totalContactsProcessed,
        zip_codes_processed: zipsToProcess.length,
        run_id: runRecord.id
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (error) {
      // Update run record with error
      await supabase
        .from('monthly_runs')
        .update({
          status: 'failed',
          error: error.message,
          finished_at: new Date().toISOString()
        })
        .eq('id', runRecord.id);

      throw error;
    }

  } catch (error) {
    console.error('Error in newsletter-send function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to send newsletter',
        details: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});