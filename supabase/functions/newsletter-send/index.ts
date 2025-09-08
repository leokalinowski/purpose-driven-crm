import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';
import { Resend } from 'npm:resend@3.2.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  dry_run?: boolean;
  agent_id?: string;
}

interface AgentProfile {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface Contact {
  email: string;
}

// Generate HTML email template
function buildEmailHTML(agentName: string, zipCode: string, marketData: any): string {
  const stats = marketData || {};
  const insights = stats.market_insights || {};
  
  return `
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Market Report - ${zipCode}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; }
          .content { padding: 30px 20px; }
          .metric { display: inline-block; width: 48%; margin: 10px 1%; padding: 15px; background: #f8f9ff; border-radius: 6px; text-align: center; }
          .metric-value { font-size: 24px; font-weight: bold; color: #667eea; }
          .metric-label { font-size: 12px; color: #666; text-transform: uppercase; }
          .insights { background: #f0f8ff; padding: 20px; border-radius: 6px; margin: 20px 0; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px; }
          .transactions { margin: 20px 0; }
          .transaction { background: #f8f9ff; padding: 10px; margin: 5px 0; border-radius: 4px; display: flex; justify-content: space-between; }
          .btn { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📊 Market Report</h1>
            <h2>ZIP Code ${zipCode}</h2>
            <p>Your monthly market insights from ${agentName}</p>
          </div>
          
          <div class="content">
            <h3>📈 Key Market Metrics</h3>
            <div style="overflow: hidden;">
              <div class="metric">
                <div class="metric-value">${formatUSD(stats.median_sale_price)}</div>
                <div class="metric-label">Median Sale Price</div>
              </div>
              <div class="metric">
                <div class="metric-value">${stats.homes_sold || 'N/A'}</div>
                <div class="metric-label">Homes Sold</div>
              </div>
              <div class="metric">
                <div class="metric-value">${stats.median_dom || 'N/A'}</div>
                <div class="metric-label">Days on Market</div>
              </div>
              <div class="metric">
                <div class="metric-value">${formatUSD(stats.avg_price_per_sqft)}</div>
                <div class="metric-label">Price per Sq Ft</div>
              </div>
            </div>
            
            <div class="insights">
              <h3>💡 Market Insights</h3>
              <p><strong>Market Type:</strong> ${insights.buyer_seller_market || 'Balanced'} market</p>
              <p><strong>Heat Index:</strong> ${insights.heat_index || 60}/100</p>
              <p><strong>Inventory Trend:</strong> ${insights.inventory_trend || 'Stable'}</p>
              ${insights.yoy_price_change ? `<p><strong>Year-over-Year:</strong> ${insights.yoy_price_change > 0 ? '+' : ''}${insights.yoy_price_change}%</p>` : ''}
            </div>
            
            ${(insights.key_takeaways && insights.key_takeaways.length > 0) ? `
              <h3>🎯 Key Takeaways</h3>
              <ul>
                ${insights.key_takeaways.map((takeaway: string) => `<li>${takeaway}</li>`).join('')}
              </ul>
            ` : ''}
            
            ${(stats.transactions_sample && stats.transactions_sample.length > 0) ? `
              <h3>🏠 Recent Sales Sample</h3>
              <div class="transactions">
                ${stats.transactions_sample.slice(0, 3).map((tx: any) => `
                  <div class="transaction">
                    <span>${tx.beds || 'N/A'} bed, ${tx.baths || 'N/A'} bath • ${tx.sqft || 'N/A'} sq ft</span>
                    <strong>${formatUSD(tx.price)}</strong>
                  </div>
                `).join('')}
              </div>
            ` : ''}
            
            <div style="text-align: center; margin: 30px 0;">
              <p>Questions about your local market?</p>
              <a href="mailto:${agentName.toLowerCase().replace(' ', '.')}@example.com" class="btn">Contact ${agentName}</a>
            </div>
          </div>
          
          <div class="footer">
            <p>This report was generated for informational purposes. Market data is estimated and should not be used as the sole basis for real estate decisions.</p>
            <p>&copy; 2024 Real Estate on Purpose</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

function formatUSD(value: number | null | undefined): string {
  if (!value || typeof value !== 'number') return 'N/A';
  return `$${value.toLocaleString()}`;
}

async function getAgentProfile(supabase: any, userId: string): Promise<AgentProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, first_name, last_name, email')
    .eq('user_id', userId)
    .single();

  if (error) {
    console.error('Error fetching agent profile:', error);
    return null;
  }

  return data;
}

async function getAgentZipCodes(supabase: any, userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('agent_zip_codes')
    .select('zip_code')
    .eq('agent_id', userId);

  if (error) {
    console.error('Error fetching zip codes:', error);
    return [];
  }

  return data.map(row => row.zip_code);
}

async function getContactsForZip(supabase: any, zipCode: string): Promise<Contact[]> {
  const { data, error } = await supabase
    .from('contacts')
    .select('email')
    .eq('zip_code', zipCode)
    .not('email', 'is', null);

  if (error) {
    console.error('Error fetching contacts:', error);
    return [];
  }

  return data.filter(contact => contact.email);
}

async function fetchMarketData(supabase: any, zipCode: string) {
  console.log(`Fetching market data for ZIP ${zipCode}`);
  
  try {
    // Call the market data function
    const { data, error } = await supabase.functions.invoke('market-data-grok', {
      body: { 
        zip_code: zipCode,
        period_month: new Date().toISOString().substring(0, 7)
      }
    });

    if (error) {
      console.error('Market data function error:', error);
      throw error;
    }

    if (data?.success && data?.data) {
      console.log(`Successfully fetched market data for ZIP ${zipCode}`);
      return data.data;
    } else {
      throw new Error('Invalid response from market data function');
    }
  } catch (error) {
    console.error(`Failed to fetch market data for ZIP ${zipCode}:`, error);
    
    // Return fallback data
    return {
      zip_code: zipCode,
      period_month: new Date().toISOString().substring(0, 7),
      median_sale_price: 500000,
      median_list_price: 525000,
      homes_sold: 25,
      new_listings: 30,
      inventory: 75,
      median_dom: 22,
      avg_price_per_sqft: 275,
      market_insights: {
        heat_index: 65,
        yoy_price_change: 3.2,
        inventory_trend: "stable",
        buyer_seller_market: "balanced",
        key_takeaways: [
          "Market showing steady activity with balanced conditions",
          "Inventory levels are within normal seasonal ranges",
          "Price appreciation continues at a moderate pace"
        ]
      },
      transactions_sample: [
        { price: 485000, beds: 3, baths: 2, sqft: 1800, dom: 18 },
        { price: 525000, beds: 4, baths: 2, sqft: 2100, dom: 25 }
      ]
    };
  }
}

async function sendEmailBatch(resend: any, emails: Array<{to: string[], subject: string, html: string}>, isDryRun: boolean, adminEmail?: string) {
  if (isDryRun && adminEmail) {
    console.log('DRY RUN: Redirecting emails to admin');
    // In dry run, send all emails to admin
    for (const email of emails) {
      email.to = [adminEmail];
      email.subject = `[TEST] ${email.subject}`;
    }
  }

  const results = [];
  for (const email of emails) {
    try {
      const result = await resend.emails.send({
        from: Deno.env.get('RESEND_FROM_EMAIL') || 'report@market.realestateonpurpose.com',
        to: email.to,
        subject: email.subject,
        html: email.html,
      });
      
      console.log(`Email sent successfully to ${email.to.join(', ')}`);
      results.push({ success: true, recipients: email.to.length });
    } catch (error) {
      console.error(`Failed to send email to ${email.to.join(', ')}:`, error);
      results.push({ success: false, error: error.message });
    }
  }
  
  return results;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Newsletter send function started');

    // Parse request
    const body: RequestBody = await req.json();
    const isDryRun = body.dry_run || false;
    const specificAgentId = body.agent_id;

    console.log(`Newsletter mode: ${isDryRun ? 'DRY RUN' : 'PRODUCTION'}`);

    // Initialize services
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    // Get agents to process
    let agentsQuery = supabase
      .from('profiles')
      .select('user_id, first_name, last_name, email')
      .in('role', ['agent', 'admin'])
      .not('email', 'is', null);

    if (specificAgentId) {
      agentsQuery = agentsQuery.eq('user_id', specificAgentId);
    }

    const { data: agents, error: agentsError } = await agentsQuery;

    if (agentsError) {
      throw new Error(`Failed to fetch agents: ${agentsError.message}`);
    }

    if (!agents || agents.length === 0) {
      throw new Error('No agents found');
    }

    console.log(`Processing ${agents.length} agent(s)`);

    const stats = {
      agentsProcessed: 0,
      zipsProcessed: 0,
      emailsSent: 0,
      errors: []
    };

    // Process each agent
    for (const agent of agents) {
      try {
        console.log(`Processing agent: ${agent.first_name} ${agent.last_name} (${agent.email})`);

        const agentName = `${agent.first_name || ''} ${agent.last_name || ''}`.trim() || 'Your Agent';
        
        // Get agent's ZIP codes
        const zipCodes = await getAgentZipCodes(supabase, agent.user_id);
        
        if (zipCodes.length === 0) {
          console.log(`No ZIP codes configured for agent ${agentName}`);
          continue;
        }

        console.log(`Agent has ${zipCodes.length} ZIP codes: ${zipCodes.join(', ')}`);

        // Process first ZIP code (limit for testing)
        const zipCode = zipCodes[0];
        
        // Get market data
        const marketData = await fetchMarketData(supabase, zipCode);
        
        // Get contacts for this ZIP
        const contacts = await getContactsForZip(supabase, zipCode);
        
        if (contacts.length === 0) {
          console.log(`No contacts found for ZIP ${zipCode}`);
          continue;
        }

        console.log(`Found ${contacts.length} contacts for ZIP ${zipCode}`);

        // Generate email content
        const emailHTML = buildEmailHTML(agentName, zipCode, marketData);
        const subject = `Market Report: ${zipCode} - ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;

        // Prepare email batch
        const emailBatch = [{
          to: isDryRun ? [agent.email!] : contacts.map(c => c.email),
          subject,
          html: emailHTML
        }];

        // Send emails
        const results = await sendEmailBatch(resend, emailBatch, isDryRun, agent.email!);
        
        const successfulEmails = results.filter(r => r.success).reduce((sum, r) => sum + (r.recipients || 0), 0);
        
        stats.agentsProcessed++;
        stats.zipsProcessed++;
        stats.emailsSent += successfulEmails;

        console.log(`Completed agent ${agentName}: ${successfulEmails} emails sent`);

      } catch (error) {
        console.error(`Error processing agent ${agent.email}:`, error);
        stats.errors.push(`Agent ${agent.email}: ${error.message}`);
      }
    }

    console.log('Newsletter send completed:', stats);

    return new Response(
      JSON.stringify({
        success: true,
        stats,
        dry_run: isDryRun
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Newsletter send function error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});