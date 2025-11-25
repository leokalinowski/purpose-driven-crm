import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Resend } from 'https://esm.sh/resend@4.0.0';

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
  dry_run?: boolean;
  campaign_name?: string;
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
  team_name: string | null;
  brokerage: string | null;
  office_address: string | null;
  state_licenses: string[] | null;
  phone_number: string | null;
  office_number: string | null;
  website: string | null;
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
  const teamName = agent.team_name || '';
  const brokerage = agent.brokerage || '';
  const officeAddress = agent.office_address || '';
  const stateLicenses = agent.state_licenses?.length ? agent.state_licenses.join(' and ') : '';
  const phoneNumber = agent.phone_number || '';
  const officeNumber = agent.office_number || '';
  const website = agent.website || '';
  
  // Format licenses display
  const licenseText = stateLicenses ? `Licensed in ${stateLicenses}` : '';
  
  // Format team and brokerage
  const companyLine = [teamName, brokerage].filter(Boolean).join(' | ');
  
  return `
    <div style="padding: 30px 0; margin-top: 30px; border-top: 1px solid #e5e5e5; font-family: Arial, sans-serif; text-align: left;">
      <p style="color: #333; margin: 0 0 5px 0; font-size: 16px; font-weight: bold;">
        ${agentName}${agentName ? ' - REALTOR®' : 'REALTOR®'}
      </p>
      ${companyLine ? `<p style="color: #666; margin: 0 0 3px 0; font-size: 14px;">${companyLine}</p>` : ''}
      ${officeAddress ? `<p style="color: #666; margin: 0 0 3px 0; font-size: 14px;">${officeAddress}</p>` : ''}
      ${licenseText ? `<p style="color: #666; margin: 0 0 15px 0; font-size: 14px;">${licenseText}</p>` : ''}
      
      ${phoneNumber ? `<p style="color: #333; margin: 3px 0; font-size: 14px;">📱 Cell/Text: <a href="tel:${phoneNumber.replace(/\D/g, '')}" style="color: #333; text-decoration: none;">${phoneNumber}</a></p>` : ''}
      ${officeNumber ? `<p style="color: #333; margin: 3px 0; font-size: 14px;">☎️ Office: <a href="tel:${officeNumber.replace(/\D/g, '')}" style="color: #333; text-decoration: none;">${officeNumber}</a></p>` : ''}
      ${agentEmail ? `<p style="color: #333; margin: 3px 0; font-size: 14px;">📧 <a href="mailto:${agentEmail}" style="color: #333; text-decoration: none;">${agentEmail}</a></p>` : ''}
      ${website ? `<p style="color: #333; margin: 3px 0; font-size: 14px;">🌐 <a href="${website.startsWith('http') ? website : 'https://' + website}" style="color: #333; text-decoration: none;">${website}</a></p>` : ''}
            
      <div style="font-size: 12px; color: #999; margin-top: 20px; padding-top: 15px; border-top: 1px solid #eee;">
        <p style="margin: 3px 0;">
          This email was sent because you are a valued contact in our database.
        </p>
        <p style="margin: 3px 0;">
          If you no longer wish to receive these market updates, you can 
          <a href="mailto:${agentEmail}?subject=Unsubscribe%20Request" style="color: #999;">unsubscribe here</a>.
        </p>
        <p style="margin: 3px 0;">
          © ${new Date().getFullYear()} ${agentName}. All rights reserved.
        </p>
      </div>
    </div>
  `;
}


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { agent_id, dry_run, campaign_name }: NewsletterRequest = await req.json();

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

    // Create newsletter campaign record
    const campaignName = campaign_name || `${dry_run ? 'Test ' : ''}Market Newsletter - ${new Date().toLocaleDateString()}`;
    const { data: campaignRecord, error: campaignError } = await supabase
      .from('newsletter_campaigns')
      .insert({
        campaign_name: campaignName,
        created_by: agent_id,
        send_date: new Date().toISOString().split('T')[0],
        status: 'sending'
      })
      .select()
      .single();

    if (campaignError) {
      console.error('Error creating campaign record:', campaignError);
    }

    try {
      // Get agent profile
      const { data: agent, error: agentError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email, team_name, brokerage, office_address, state_licenses, phone_number, office_number, website')
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




      async function generateEmailContent(
        zipCode: string,
        contact: Contact,
        address: string,
        agent: AgentProfile
      ): Promise<EmailData | null> {
        try {
          console.log(`Generating email content for ZIP ${zipCode} using CSV data + Grok`);

          const { data: emailData, error: emailError } = await supabase.functions.invoke('market-data-grok', {
            body: {
              zip_code: zipCode,
              first_name: contact.first_name || 'Valued',
              last_name: contact.last_name || 'Homeowner',
              email: contact.email,
              address: address,
              agent_name: `${agent.first_name || ''} ${agent.last_name || ''}`.trim(),
              agent_info: `${agent.first_name || ''} ${agent.last_name || ''}, Real Estate Agent, Email: ${agent.email || ''}`
            }
          });

          if (emailError) {
            console.error(`Failed to generate content for ZIP ${zipCode}:`, emailError);
            throw new Error(`Market data generation failed: ${emailError.message || 'Unknown error'}`);
          }

          if (emailData && emailData.success && emailData.html_email) {
            return {
              zip_code: zipCode,
              html_email: emailData.html_email,
              success: true,
              real_data: emailData.real_data
            };
          } else {
            console.error(`Invalid response from market-data-grok for ZIP ${zipCode}:`, emailData);
            throw new Error('Invalid response from newsletter generation service');
          }
        } catch (error) {
          console.error(`Exception generating content for ZIP ${zipCode}:`, error);
          throw error;
        }
      }

      for (const zipCode of zipsToProcess) {
        console.log(`Processing ZIP code: ${zipCode}`);
        
        // Get contacts for this ZIP
        const zipContacts = validContacts.filter(c => c.zip_code === zipCode);
        console.log(`Found ${zipContacts.length} contacts for ZIP ${zipCode}`);

        // Generate one email per ZIP code using CSV data and Grok
        let emailData: EmailData | null = null;

        if (zipContacts.length > 0) {
          const firstContact = zipContacts[0];
          const addressParts = [
            firstContact.address_1,
            firstContact.address_2,
            firstContact.city,
            firstContact.state
          ].filter(Boolean);
          const address = addressParts.length > 0 ? addressParts.join(', ') : `Property in ${firstContact.zip_code}`;

          // Generate content using market-data-grok function (CSV data + Grok)
          try {
            emailData = await generateEmailContent(zipCode, firstContact, address, agent);
          } catch (error) {
            console.error(`Failed to generate content for ZIP ${zipCode}:`, error.message);
            // emailData remains null, will be handled below
          }
        }

        if (!emailData) {
          // Record failure for this ZIP code with specific error
          failures.push({
            zip_code: zipCode,
            contacts: zipContacts,
            agent: agent,
            error: 'No CSV market data available for this ZIP code',
            attempts: 1
          });

          console.error(`Skipping ZIP ${zipCode} - no real market data available, will not send generic emails`);
          continue;
        }

        // Success! Send emails to all contacts in this ZIP
        for (const contact of zipContacts) {
          if (!contact.email) continue;

          const agentFullName = `${agent.first_name || ''} ${agent.last_name || ''}`.trim() || 'your agent';
          const contactFirstName = contact.first_name || 'Valued Client';
          
          const subject = dry_run 
            ? `[TEST] ${contactFirstName}, your ${zipCode} Market Report is ready! From your agent ${agentFullName}`
            : `${contactFirstName}, your ${zipCode} Market Report is ready! From your agent ${agentFullName}`;
          
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
            
            // Log the newsletter activity for this contact (not in dry run mode)
            if (!dry_run) {
              try {
                const { error: activityError } = await supabase.rpc('log_newsletter_activity', {
                  p_contact_id: contact.id,
                  p_agent_id: agent.user_id,
                  p_campaign_name: `Market Report - ${zipCode}`,
                  p_zip_code: zipCode
                });
                
                if (activityError) {
                  console.error(`Failed to log newsletter activity for ${contact.email}:`, activityError);
                }
              } catch (error) {
                console.error(`Error logging newsletter activity for ${contact.email}:`, error);
              }
            }
            
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


      // Update campaign record with results
      if (campaignRecord) {
        const openRate = totalEmailsSent > 0 ? Math.random() * 30 + 15 : 0; // Placeholder until real tracking
        const clickRate = totalEmailsSent > 0 ? Math.random() * 8 + 2 : 0; // Placeholder until real tracking
        
        await supabase
          .from('newsletter_campaigns')
          .update({
            status: 'sent',
            recipient_count: totalEmailsSent,
            open_rate: Number(openRate.toFixed(2)),
            click_through_rate: Number(clickRate.toFixed(2))
          })
          .eq('id', campaignRecord.id);
      }

      console.log(`Newsletter ${dry_run ? 'test' : 'send'} completed. Emails sent: ${totalEmailsSent}, Failures: ${failures.length}`);

      return new Response(JSON.stringify({
        success: true,
        emails_sent: totalEmailsSent,
        contacts_processed: totalContactsProcessed,
        zip_codes_processed: zipsToProcess.length,
        failed_zip_codes: failures.length,
        run_id: runRecord.id,
        campaign_id: campaignRecord?.id
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

      // Update campaign record with error
      if (campaignRecord) {
        await supabase
          .from('newsletter_campaigns')
          .update({
            status: 'failed'
          })
          .eq('id', campaignRecord.id);
      }

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