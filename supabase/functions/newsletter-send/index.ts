import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Resend } from 'npm:resend@4.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function sendFailureReport(
  failures: FailureData[], 
  agent: AgentProfile, 
  resend: any,
  totalEmailsSent: number,
  totalContactsProcessed: number
) {
  console.log(`Sending failure report for ${failures.length} failed ZIP codes`);

  // Create HTML table of failures
  const failureRows = failures.map(failure => {
    const contactList = failure.contacts.map(c => 
      `${c.first_name || ''} ${c.last_name || ''} (${c.email})`.trim()
    ).join('<br>');
    
    return `
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;">${failure.zip_code}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${failure.contacts.length}</td>
        <td style="border: 1px solid #ddd; padding: 8px; font-size: 12px;">${contactList}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${failure.agent.first_name} ${failure.agent.last_name} (${failure.agent.email})</td>
        <td style="border: 1px solid #ddd; padding: 8px; font-size: 12px;">${failure.error}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${failure.attempts}</td>
      </tr>
    `;
  }).join('');

  const htmlContent = `
    <html>
      <body style="font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px;">
        <h2>Newsletter Generation Failure Report</h2>
        <p><strong>Date:</strong> ${new Date().toISOString()}</p>
        <p><strong>Agent:</strong> ${agent.first_name} ${agent.last_name} (${agent.email})</p>
        <p><strong>Total Emails Sent:</strong> ${totalEmailsSent}</p>
        <p><strong>Total Contacts Processed:</strong> ${totalContactsProcessed}</p>
        <p><strong>Failed ZIP Codes:</strong> ${failures.length}</p>
        
        <h3>Failure Details</h3>
        <table style="border-collapse: collapse; width: 100%;">
          <thead>
            <tr style="background-color: #f2f2f2;">
              <th style="border: 1px solid #ddd; padding: 10px; text-align: left;">ZIP Code</th>
              <th style="border: 1px solid #ddd; padding: 10px; text-align: left;">Contact Count</th>
              <th style="border: 1px solid #ddd; padding: 10px; text-align: left;">Contact Details</th>
              <th style="border: 1px solid #ddd; padding: 10px; text-align: left;">Agent</th>
              <th style="border: 1px solid #ddd; padding: 10px; text-align: left;">Error</th>
              <th style="border: 1px solid #ddd; padding: 10px; text-align: left;">Attempts</th>
            </tr>
          </thead>
          <tbody>
            ${failureRows}
          </tbody>
        </table>
        
        <p style="margin-top: 20px; font-style: italic;">
          This report contains all ZIP codes that failed to generate market reports after 3 attempts with model switching.
        </p>
      </body>
    </html>
  `;

  try {
    await resend.emails.send({
      from: `Newsletter System <${Deno.env.get('RESEND_FROM_EMAIL')}>`,
      to: ['leonardo@realestateonpurpose.com'],
      subject: `Newsletter Failure Report - ${failures.length} Failed ZIP Codes - ${new Date().toLocaleDateString()}`,
      html: htmlContent,
    });
    
    console.log('Failure report sent successfully to Leonardo');
  } catch (error) {
    console.error('Failed to send failure report:', error);
  }
}

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
  success: boolean;
  retry_attempt?: number;
  model_used?: string;
}

interface FailureData {
  zip_code: string;
  contacts: Contact[];
  agent: AgentProfile;
  error: string;
  attempts: number;
}

function generateStandardFooter(agent: AgentProfile): string {
  const agentName = `${agent.first_name || ''} ${agent.last_name || ''}`.trim() || 'Your Real Estate Agent';
  const agentEmail = agent.email || '';
  
  return `
    <div style="margin-top: 30px; padding: 20px; border-top: 2px solid #e5e5e5; background-color: #f9f9f9; font-family: Arial, sans-serif;">
      <table style="width: 100%; max-width: 600px;">
        <tr>
          <td style="text-align: center;">
            <h3 style="color: #2c3e50; margin: 0 0 15px 0; font-size: 20px;">Ready to Make Your Next Move?</h3>
            <p style="color: #34495e; margin: 0 0 20px 0; font-size: 16px;">
              As your local real estate expert, I'm here to help with all your property needs.
            </p>
          </td>
        </tr>
        <tr>
          <td style="text-align: center; padding: 20px; background-color: white; border-radius: 8px;">
            <div style="margin-bottom: 15px;">
              <strong style="color: #2c3e50; font-size: 18px; display: block;">${agentName}</strong>
              <span style="color: #7f8c8d; font-size: 14px;">Licensed Real Estate Agent</span>
            </div>
            <div style="margin: 15px 0;">
              <p style="margin: 5px 0; color: #34495e;">
                📧 <a href="mailto:${agentEmail}" style="color: #3498db; text-decoration: none;">${agentEmail}</a>
              </p>
            </div>
            <div style="margin-top: 20px; padding: 15px; background-color: #3498db; border-radius: 5px;">
              <p style="margin: 0; color: white; font-weight: bold; font-size: 16px;">
                📞 Call me today for a free market analysis of your property!
              </p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="text-align: center; padding-top: 20px;">
            <div style="font-size: 12px; color: #95a5a6; line-height: 1.4;">
              <p style="margin: 5px 0;">
                This email was sent by ${agentName}. You are receiving this because you are a valued client.
              </p>
              <p style="margin: 5px 0;">
                To unsubscribe from future market updates, please reply with "UNSUBSCRIBE" in the subject line.
              </p>
              <p style="margin: 5px 0;">
                © ${new Date().getFullYear()} ${agentName}. All rights reserved.
              </p>
            </div>
          </td>
        </tr>
      </table>
    </div>
  `;
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
      const failures: FailureData[] = [];
      const GROK_MODELS = ['grok-2-1212', 'grok-beta', 'grok-2'];

      async function generateEmailWithRetry(
        zipCode: string, 
        contact: Contact, 
        address: string, 
        agent: AgentProfile
      ): Promise<EmailData | null> {
        let lastError = '';
        
        for (let attempt = 1; attempt <= 3; attempt++) {
          // Model switching: use different model after 2 failures
          const modelIndex = attempt <= 2 ? 0 : Math.min(attempt - 2, GROK_MODELS.length - 1);
          const model = GROK_MODELS[modelIndex];
          
          console.log(`ZIP ${zipCode}, attempt ${attempt} using model: ${model}`);
          
          try {
            const { data: emailData, error: emailError } = await supabase.functions.invoke('market-data-grok', {
              body: {
                zip_code: zipCode,
                first_name: contact.first_name || '',
                last_name: contact.last_name || '',
                email: contact.email,
                address: address,
                agent_name: `${agent.first_name || ''} ${agent.last_name || ''}`.trim(),
                agent_info: `${agent.first_name || ''} ${agent.last_name || ''}, Real Estate Agent, Email: ${agent.email || ''}`,
                retry_attempt: attempt,
                model: model
              }
            });

            if (emailError) {
              lastError = emailError.message;
              console.error(`Attempt ${attempt} failed for ZIP ${zipCode}:`, emailError);
              continue;
            }

            if (emailData && emailData.success) {
              console.log(`Success on attempt ${attempt} for ZIP ${zipCode} using ${emailData.model_used}`);
              return emailData;
            } else {
              lastError = emailData?.error || 'Unknown error';
              console.error(`Attempt ${attempt} failed for ZIP ${zipCode}:`, lastError);
              
              // If not retryable, skip remaining attempts
              if (emailData && !emailData.retryable) {
                console.log(`Non-retryable error for ZIP ${zipCode}, skipping remaining attempts`);
                break;
              }
            }
          } catch (error) {
            lastError = error.message;
            console.error(`Attempt ${attempt} exception for ZIP ${zipCode}:`, error);
          }
        }
        
        // All attempts failed, record failure
        console.error(`All attempts failed for ZIP ${zipCode}. Last error: ${lastError}`);
        return null;
      }

      for (const zipCode of zipsToProcess) {
        console.log(`Processing ZIP code: ${zipCode}`);
        
        // Get contacts for this ZIP
        const zipContacts = validContacts.filter(c => c.zip_code === zipCode);
        console.log(`Found ${zipContacts.length} contacts for ZIP ${zipCode}`);

        // Try to generate email for this ZIP code (with retries and model switching)
        let emailData: EmailData | null = null;
        
        if (zipContacts.length > 0) {
          const firstContact = zipContacts[0];
          const addressParts = [
            firstContact.address_1,
            firstContact.address_2,
            firstContact.city,
            firstContact.state
          ].filter(Boolean);
          const address = addressParts.length > 0 ? addressParts.join(', ') : `ZIP ${firstContact.zip_code}`;

          emailData = await generateEmailWithRetry(zipCode, firstContact, address, agent);
        }

        if (!emailData) {
          // All attempts failed for this ZIP code, record the failure
          failures.push({
            zip_code: zipCode,
            contacts: zipContacts,
            agent: agent,
            error: 'Failed to generate email after 3 attempts with model switching',
            attempts: 3
          });
          
          console.error(`Skipping ZIP ${zipCode} after all retry attempts failed`);
          continue;
        }

        // Success! Send emails to all contacts in this ZIP
        for (const contact of zipContacts) {
          if (!contact.email) continue;

          const subject = dry_run 
            ? `[TEST] Your ${zipCode} Market Report - ${new Date().toLocaleDateString()}`
            : `Your ${zipCode} Market Report - ${new Date().toLocaleDateString()}`;
          
          const toEmail = dry_run ? agent.email! : contact.email;
          const fromName = `${agent.first_name || ''} ${agent.last_name || ''}`.trim() || 'Your Real Estate Agent';

          try {
            // Combine Grok's email content with standardized footer
            const finalEmailHtml = emailData.html_email + generateStandardFooter(agent);
            
            await resend.emails.send({
              from: `${fromName} <${Deno.env.get('RESEND_FROM_EMAIL')}>`,
              to: [toEmail],
              subject,
              html: finalEmailHtml,
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

      // Send failure report if there are any failures
      if (failures.length > 0) {
        await sendFailureReport(failures, agent, resend, totalEmailsSent, totalContactsProcessed);
      }

      // Update run record with results
      await supabase
        .from('monthly_runs')
        .update({
          status: 'completed',
          emails_sent: totalEmailsSent,
          contacts_processed: totalContactsProcessed,
          zip_codes_processed: zipsToProcess.length,
          failed_zip_codes: failures.length,
          finished_at: new Date().toISOString()
        })
        .eq('id', runRecord.id);

      console.log(`Newsletter ${dry_run ? 'test' : 'send'} completed. Emails sent: ${totalEmailsSent}, Failures: ${failures.length}`);

      return new Response(JSON.stringify({
        success: true,
        emails_sent: totalEmailsSent,
        contacts_processed: totalContactsProcessed,
        zip_codes_processed: zipsToProcess.length,
        failed_zip_codes: failures.length,
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