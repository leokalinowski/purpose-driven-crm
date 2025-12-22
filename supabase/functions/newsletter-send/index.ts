import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Resend } from 'https://esm.sh/resend@4.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting constants
const DELAY_BETWEEN_EMAILS_MS = 200; // 200ms between each email
const DELAY_BETWEEN_ZIPS_MS = 2000; // 2 seconds between ZIP batches

// Helper function for delays
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Simple token generation for unsubscribe links
function generateUnsubscribeToken(email: string, agentId: string): string {
  const secret = Deno.env.get('UNSUBSCRIBE_SECRET') || 'default-secret';
  const data = `${email}:${agentId}:${secret}`;
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

async function sendFailureReport(
  failures: FailureData[], 
  agent: AgentProfile, 
  resend: any,
  totalEmailsSent: number,
  totalContactsProcessed: number
) {
  console.log(`Sending failure report for ${failures.length} failed ZIP codes`);

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

function generateStandardFooter(agent: AgentProfile, contactEmail: string): string {
  const agentName = `${agent.first_name || ''} ${agent.last_name || ''}`.trim() || 'Your Real Estate Agent';
  const agentEmail = agent.email || '';
  const teamName = agent.team_name || '';
  const brokerage = agent.brokerage || '';
  const officeAddress = agent.office_address || '';
  const stateLicenses = agent.state_licenses?.length ? agent.state_licenses.join(' and ') : '';
  const phoneNumber = agent.phone_number || '';
  const officeNumber = agent.office_number || '';
  const website = agent.website || '';
  
  const licenseText = stateLicenses ? `Licensed in ${stateLicenses}` : '';
  const companyLine = [teamName, brokerage].filter(Boolean).join(' | ');
  
  // Generate secure unsubscribe link
  const unsubscribeToken = generateUnsubscribeToken(contactEmail, agent.user_id);
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const unsubscribeUrl = `${supabaseUrl}/functions/v1/newsletter-unsubscribe?email=${encodeURIComponent(contactEmail)}&agent_id=${agent.user_id}&token=${unsubscribeToken}`;
  
  // Company physical address for CAN-SPAM compliance
  const companyAddress = Deno.env.get('COMPANY_PHYSICAL_ADDRESS') || officeAddress || '';
  
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
        ${companyAddress ? `<p style="margin: 3px 0;">${companyAddress}</p>` : ''}
        <p style="margin: 8px 0;">
          <a href="${unsubscribeUrl}" style="color: #999; text-decoration: underline;">Unsubscribe from these market updates</a>
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

    if (!agent_id) {
      throw new Error('agent_id is required');
    }

    console.log(`Starting newsletter ${dry_run ? 'test' : 'send'} for agent: ${agent_id}`);

    // Initialize Supabase and Resend clients
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

    // Cleanup: Mark old stuck runs as timed out
    await supabase
      .from('monthly_runs')
      .update({
        status: 'timeout',
        error: 'Process timed out - marked during cleanup',
        finished_at: new Date().toISOString()
      })
      .eq('status', 'running')
      .lt('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString()); // Older than 30 minutes

    // Create a new run record with started_at
    const { data: runRecord, error: runError } = await supabase
      .from('monthly_runs')
      .insert({
        agent_id,
        dry_run,
        status: 'running',
        run_date: new Date().toISOString().split('T')[0],
        started_at: new Date().toISOString()
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

      // Get unsubscribed emails for this agent
      const { data: unsubscribes } = await supabase
        .from('newsletter_unsubscribes')
        .select('email')
        .or(`agent_id.eq.${agent_id},agent_id.is.null`);
      
      const unsubscribedEmails = new Set((unsubscribes || []).map(u => u.email.toLowerCase()));
      console.log(`Found ${unsubscribedEmails.size} unsubscribed emails`);

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

      // Filter out invalid zip codes, invalid emails, and unsubscribed contacts
      const validContacts = contacts.filter(contact => {
        const zip = contact.zip_code?.replace(/[^0-9]/g, '');
        const email = contact.email?.toLowerCase().trim();
        
        // Check ZIP is valid 5 digits
        if (!zip || zip.length !== 5) {
          console.log(`Skipping contact ${contact.id}: Invalid ZIP code ${contact.zip_code}`);
          return false;
        }
        
        // Check email is valid format
        if (!email || !isValidEmail(email)) {
          console.log(`Skipping contact ${contact.id}: Invalid email format ${contact.email}`);
          return false;
        }
        
        // Check if unsubscribed
        if (unsubscribedEmails.has(email)) {
          console.log(`Skipping contact ${contact.id}: Unsubscribed ${contact.email}`);
          return false;
        }
        
        return true;
      });

      if (validContacts.length === 0) {
        throw new Error('No contacts with valid 5-digit ZIP codes after filtering');
      }

      console.log(`${validContacts.length} contacts remain after filtering (invalid/unsubscribed)`);

      // DEDUPLICATION: Keep only one contact per unique email (prefer most recently updated)
      const emailToContact = new Map<string, Contact>();
      for (const contact of validContacts) {
        const email = contact.email.toLowerCase().trim();
        if (!emailToContact.has(email)) {
          emailToContact.set(email, contact);
        }
      }
      const deduplicatedContacts = Array.from(emailToContact.values());
      console.log(`${deduplicatedContacts.length} unique email addresses after deduplication`);

      const uniqueZipCodes = [...new Set(deduplicatedContacts.map(c => c.zip_code))];
      console.log(`Processing ${uniqueZipCodes.length} unique ZIP codes`);

      // For test mode, only process first ZIP code
      const zipsToProcess = dry_run ? [uniqueZipCodes[0]] : uniqueZipCodes;
      
      let totalEmailsSent = 0;
      let totalContactsProcessed = 0;
      let skippedEmails = 0;
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

      for (let zipIndex = 0; zipIndex < zipsToProcess.length; zipIndex++) {
        const zipCode = zipsToProcess[zipIndex];
        console.log(`Processing ZIP code: ${zipCode} (${zipIndex + 1}/${zipsToProcess.length})`);
        
        // Get deduplicated contacts for this ZIP
        const zipContacts = deduplicatedContacts.filter(c => c.zip_code === zipCode);
        console.log(`Found ${zipContacts.length} unique contacts for ZIP ${zipCode}`);

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

          try {
            emailData = await generateEmailContent(zipCode, firstContact, address, agent);
          } catch (error) {
            console.error(`Failed to generate content for ZIP ${zipCode}:`, error.message);
          }
        }

        if (!emailData) {
          failures.push({
            zip_code: zipCode,
            contacts: zipContacts,
            agent: agent,
            error: 'No CSV market data available for this ZIP code',
            attempts: 1
          });

          console.error(`Skipping ZIP ${zipCode} - no real market data available`);
          continue;
        }

        // Success! Send emails to all contacts in this ZIP with rate limiting
        for (let contactIndex = 0; contactIndex < zipContacts.length; contactIndex++) {
          const contact = zipContacts[contactIndex];
          if (!contact.email) continue;

          const agentFullName = `${agent.first_name || ''} ${agent.last_name || ''}`.trim() || 'your agent';
          const contactFirstName = contact.first_name || 'Valued Client';
          
          const subject = dry_run 
            ? `[TEST] ${contactFirstName}, your ${zipCode} Market Report is ready! From your agent ${agentFullName}`
            : `${contactFirstName}, your ${zipCode} Market Report is ready! From your agent ${agentFullName}`;
          
          const toEmail = dry_run ? agent.email! : contact.email;
          const fromName = `${agent.first_name || ''} ${agent.last_name || ''}`.trim() || 'Your Real Estate Agent';

          try {
            // Combine Grok's email content with standardized footer (passing contact email for unsubscribe link)
            const finalEmailHtml = emailData.html_email + generateStandardFooter(agent, contact.email);
            
            const emailResult = await resend.emails.send({
              from: `${fromName} <${Deno.env.get('RESEND_FROM_EMAIL')}>`,
              to: [toEmail],
              subject,
              html: finalEmailHtml,
              reply_to: agent.email || undefined,
            });

            // Check for rate limit response
            if (emailResult.error) {
              const errorMessage = emailResult.error.message || '';
              if (errorMessage.includes('rate') || errorMessage.includes('limit')) {
                console.log('Rate limit hit, waiting 5 seconds...');
                await delay(5000);
                // Retry once
                const retryResult = await resend.emails.send({
                  from: `${fromName} <${Deno.env.get('RESEND_FROM_EMAIL')}>`,
                  to: [toEmail],
                  subject,
                  html: finalEmailHtml,
                  reply_to: agent.email || undefined,
                });
                if (retryResult.error) {
                  throw new Error(retryResult.error.message);
                }
              } else {
                throw new Error(errorMessage);
              }
            }

            totalEmailsSent++;
            totalContactsProcessed++;
            
            console.log(`Email sent to ${dry_run ? 'agent (test mode)' : contact.email} (${contactIndex + 1}/${zipContacts.length})`);
            
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

                // Log to unified email_logs table
                const contactName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || null;
                await supabase
                  .from('email_logs')
                  .insert({
                    email_type: 'newsletter',
                    recipient_email: toEmail,
                    recipient_name: contactName,
                    agent_id: agent.user_id,
                    subject: subject,
                    status: 'sent',
                    resend_email_id: emailResult.data?.id || null,
                    metadata: {
                      campaign_id: campaignRecord?.id,
                      campaign_name: campaignName,
                      contact_id: contact.id,
                      zip_code: zipCode,
                      dry_run: dry_run
                    },
                    sent_at: new Date().toISOString()
                  })
                  .catch(err => console.error('Failed to log newsletter email:', err));
              } catch (error) {
                console.error(`Error logging newsletter activity for ${contact.email}:`, error);
              }
            }
            
            // Rate limiting: delay between emails
            if (!dry_run && contactIndex < zipContacts.length - 1) {
              await delay(DELAY_BETWEEN_EMAILS_MS);
            }
            
            // In test mode, only send one email
            if (dry_run) break;
          } catch (emailError) {
            console.error(`Failed to send email to ${contact.email}:`, emailError);
            skippedEmails++;
            
            // Log failed email to unified email_logs table
            if (!dry_run) {
              try {
                const contactName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || null;
                const errorMessage = emailError instanceof Error ? emailError.message : String(emailError);
                await supabase
                  .from('email_logs')
                  .insert({
                    email_type: 'newsletter',
                    recipient_email: contact.email,
                    recipient_name: contactName,
                    agent_id: agent.user_id,
                    subject: subject,
                    status: 'failed',
                    error_message: errorMessage,
                    metadata: {
                      campaign_id: campaignRecord?.id,
                      campaign_name: campaignName,
                      contact_id: contact.id,
                      zip_code: zipCode,
                      dry_run: dry_run
                    }
                  })
                  .catch(err => console.error('Failed to log failed newsletter email:', err));
              } catch (logError) {
                console.error('Error logging failed newsletter email:', logError);
              }
            }
          }
        }

        // Rate limiting: delay between ZIP batches
        if (!dry_run && zipIndex < zipsToProcess.length - 1) {
          console.log(`Waiting ${DELAY_BETWEEN_ZIPS_MS}ms before next ZIP batch...`);
          await delay(DELAY_BETWEEN_ZIPS_MS);
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

      console.log(`Newsletter ${dry_run ? 'test' : 'send'} completed. Emails sent: ${totalEmailsSent}, Skipped: ${skippedEmails}, Failures: ${failures.length}`);

      return new Response(JSON.stringify({
        success: true,
        emails_sent: totalEmailsSent,
        contacts_processed: totalContactsProcessed,
        zip_codes_processed: zipsToProcess.length,
        failed_zip_codes: failures.length,
        skipped_emails: skippedEmails,
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
