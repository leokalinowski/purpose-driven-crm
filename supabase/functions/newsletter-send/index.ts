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
}

interface AgentProfile {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface MarketData {
  zip_code: string;
  market_summary: string;
  median_home_price: string;
  price_trend: string;
  inventory_levels: string;
  days_on_market: string;
  market_temperature: string;
  buyer_seller_tips: string[];
  local_highlights: string[];
}

function generateEmailHTML(contact: Contact, agent: AgentProfile, marketData: MarketData): string {
  const agentName = `${agent.first_name || ''} ${agent.last_name || ''}`.trim();
  const contactName = contact.first_name ? `${contact.first_name}` : 'Valued Client';
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Local Market Report</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8f9fa;">
  <div style="max-width: 600px; margin: 0 auto; background-color: white;">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 40px 30px; text-align: center;">
      <h1 style="margin: 0; font-size: 28px; font-weight: 600;">Your Local Market Report</h1>
      <p style="margin: 10px 0 0; font-size: 16px; opacity: 0.9;">ZIP Code ${marketData.zip_code}</p>
    </div>

    <!-- Personal Greeting -->
    <div style="padding: 30px;">
      <h2 style="color: #1f2937; margin: 0 0 15px; font-size: 22px;">Hello ${contactName},</h2>
      <p style="color: #4b5563; line-height: 1.6; margin: 0 0 25px; font-size: 16px;">
        Here's your personalized market update for the ${marketData.zip_code} area. I'm keeping you informed about the latest trends and opportunities in your neighborhood.
      </p>
    </div>

    <!-- Market Summary -->
    <div style="margin: 0 30px 25px; padding: 25px; background-color: #f1f5f9; border-radius: 8px; border-left: 4px solid #2563eb;">
      <h3 style="color: #1e40af; margin: 0 0 15px; font-size: 18px;">Market Overview</h3>
      <p style="color: #374151; line-height: 1.6; margin: 0; font-size: 15px;">${marketData.market_summary}</p>
    </div>

    <!-- Key Metrics -->
    <div style="padding: 0 30px;">
      <h3 style="color: #1f2937; margin: 0 0 20px; font-size: 20px;">Key Market Metrics</h3>
      
      <div style="display: grid; gap: 15px; margin-bottom: 30px;">
        <div style="display: flex; justify-content: space-between; padding: 15px; background-color: #fefefe; border: 1px solid #e5e7eb; border-radius: 6px;">
          <span style="color: #6b7280; font-weight: 500;">Median Home Price</span>
          <span style="color: #059669; font-weight: 600; font-size: 16px;">${marketData.median_home_price}</span>
        </div>
        
        <div style="display: flex; justify-content: space-between; padding: 15px; background-color: #fefefe; border: 1px solid #e5e7eb; border-radius: 6px;">
          <span style="color: #6b7280; font-weight: 500;">Price Trend</span>
          <span style="color: #dc2626; font-weight: 600;">${marketData.price_trend}</span>
        </div>
        
        <div style="display: flex; justify-content: space-between; padding: 15px; background-color: #fefefe; border: 1px solid #e5e7eb; border-radius: 6px;">
          <span style="color: #6b7280; font-weight: 500;">Average Days on Market</span>
          <span style="color: #1f2937; font-weight: 600;">${marketData.days_on_market}</span>
        </div>
        
        <div style="display: flex; justify-content: space-between; padding: 15px; background-color: #fefefe; border: 1px solid #e5e7eb; border-radius: 6px;">
          <span style="color: #6b7280; font-weight: 500;">Market Temperature</span>
          <span style="color: #7c3aed; font-weight: 600;">${marketData.market_temperature}</span>
        </div>
      </div>
    </div>

    <!-- Inventory Levels -->
    <div style="margin: 0 30px 25px; padding: 20px; background-color: #fef3c7; border-radius: 8px;">
      <h4 style="color: #92400e; margin: 0 0 10px; font-size: 16px;">Inventory Update</h4>
      <p style="color: #78350f; margin: 0; font-size: 14px;">${marketData.inventory_levels}</p>
    </div>

    <!-- Tips Section -->
    <div style="padding: 0 30px; margin-bottom: 25px;">
      <h3 style="color: #1f2937; margin: 0 0 15px; font-size: 18px;">Market Insights & Tips</h3>
      ${marketData.buyer_seller_tips.map(tip => 
        `<div style="margin-bottom: 12px; padding-left: 20px; position: relative;">
          <div style="position: absolute; left: 0; top: 6px; width: 8px; height: 8px; background-color: #2563eb; border-radius: 50%;"></div>
          <p style="margin: 0; color: #4b5563; line-height: 1.5; font-size: 14px;">${tip}</p>
        </div>`
      ).join('')}
    </div>

    <!-- Local Highlights -->
    ${marketData.local_highlights.length > 0 ? `
    <div style="margin: 0 30px 30px; padding: 20px; background-color: #ecfdf5; border-radius: 8px;">
      <h4 style="color: #065f46; margin: 0 0 15px; font-size: 16px;">Local Highlights</h4>
      ${marketData.local_highlights.map(highlight => 
        `<div style="margin-bottom: 8px; padding-left: 15px; position: relative;">
          <div style="position: absolute; left: 0; top: 6px; width: 6px; height: 6px; background-color: #059669; border-radius: 50%;"></div>
          <p style="margin: 0; color: #047857; font-size: 14px;">${highlight}</p>
        </div>`
      ).join('')}
    </div>` : ''}

    <!-- CTA Section -->
    <div style="margin: 0 30px 40px; padding: 25px; background-color: #1f2937; border-radius: 8px; text-align: center;">
      <h3 style="color: white; margin: 0 0 15px; font-size: 18px;">Ready to Make Your Move?</h3>
      <p style="color: #d1d5db; margin: 0 0 20px; font-size: 14px;">
        Whether you're buying or selling, I'm here to help you navigate this market with confidence.
      </p>
      <a href="mailto:${agent.email}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">Contact Me Today</a>
    </div>

    <!-- Footer -->
    <div style="padding: 30px; text-align: center; background-color: #f8f9fa; border-top: 1px solid #e5e7eb;">
      <p style="color: #1f2937; margin: 0 0 10px; font-size: 16px; font-weight: 600;">${agentName}</p>
      <p style="color: #6b7280; margin: 0 0 5px; font-size: 14px;">${agent.email}</p>
      <p style="color: #9ca3af; margin: 15px 0 0; font-size: 12px;">
        You're receiving this because you're a valued client. This market report is prepared exclusively for you.
      </p>
    </div>
    
  </div>
</body>
</html>`;
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

      // Get agent's contacts with valid email and zip_code
      const { data: contacts, error: contactsError } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, email, zip_code')
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
        
        // Get market data for this ZIP
        const { data: marketData, error: marketError } = await supabase.functions.invoke('market-data-grok', {
          body: { zip_code: zipCode }
        });

        if (marketError) {
          console.error(`Failed to get market data for ZIP ${zipCode}:`, marketError);
          continue;
        }

        // Get contacts for this ZIP
        const zipContacts = validContacts.filter(c => c.zip_code === zipCode);
        console.log(`Found ${zipContacts.length} contacts for ZIP ${zipCode}`);

        // Generate and send emails for each contact
        for (const contact of zipContacts) {
          if (!contact.email) continue;

          const emailHTML = generateEmailHTML(contact, agent, marketData);
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
              html: emailHTML,
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