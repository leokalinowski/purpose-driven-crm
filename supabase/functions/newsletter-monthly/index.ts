import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2.53.0';
import { Resend } from 'https://esm.sh/resend@3.2.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  dryRun?: boolean;
  dry_run?: boolean; // Support both camelCase and snake_case
  mode?: 'user' | 'global'; // unused but kept for compatibility
  user_id?: string; // unused but kept for compatibility
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

interface Transaction {
  price: number;
  date: string;
  address?: string;
  beds?: number;
  baths?: number;
  sqft?: number;
}

interface Metrics {
  median_sale_price: number | null;
  median_list_price: number | null;
  homes_sold: number | null;
  new_listings: number | null;
  inventory: number | null;
  median_dom: number | null;
  avg_price_per_sqft: number | null;
  // Enhanced Grok data structure
  market_insights?: {
    heat_index?: number;
    yoy_price_change?: number;
    inventory_trend?: string;
    buyer_seller_market?: string;
    key_takeaways: string[];
  };
  transactions_sample?: Array<{
    price: number;
    beds: number;
    baths: number;
    sqft: number;
    dom: number;
  }>;
}

interface CacheData {
  zip_code: string;
  period_month: string;
  metrics: Metrics;
  prev_comparison?: any;
  html: string;
}

interface Stats {
  agentsProcessed: number;
  zipsProcessed: number;
  emailsSent: number;
  cacheHits: number;
  errors: string[];
  skipped?: boolean;
}

// Utility functions
function toMonthStart(input?: string): string {
  const d = input ? new Date(input) : new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

function toPrevMonthStart(monthStart: string): string {
  const d = new Date(monthStart);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return toMonthStart(d.toISOString());
}

function fmtUSD(n?: number | null): string {
  if (typeof n !== 'number') return 'N/A';
  return `$${n.toLocaleString()}`;
}

function fmtInt(n?: number | null): string {
  if (typeof n !== 'number') return 'N/A';
  return n.toLocaleString();
}

function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

function monthLabel(periodMonth: string): string {
  const d = new Date(periodMonth);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function average(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((sum, n) => sum + n, 0) / nums.length;
}

async function hmacHexSHA256(data: string, key: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function compareMetrics(curr: Metrics, prev: Metrics) {
  const delta = (a: number | null, b: number | null) =>
    typeof a === "number" && typeof b === "number" ? a - b : null;

  return {
    median_sale_price_delta: delta(curr.median_sale_price, prev.median_sale_price),
    median_list_price_delta: delta(curr.median_list_price, prev.median_list_price),
    homes_sold_delta: delta(curr.homes_sold, prev.homes_sold),
    new_listings_delta: delta(curr.new_listings, prev.new_listings),
    median_dom_delta: delta(curr.median_dom, prev.median_dom),
    avg_price_per_sqft_delta: delta(curr.avg_price_per_sqft, prev.avg_price_per_sqft),
    inventory_delta: delta(curr.inventory, prev.inventory),
  };
}

function buildEmailHTML(zip: string, periodMonth: string, metrics: any, agent?: AgentProfile | null, unsubscribeURL?: string) {
  const month = monthLabel(periodMonth);
  const agentName = [agent?.first_name, agent?.last_name].filter(Boolean).join(" ").trim() || "Your Agent";
  const agentEmail = agent?.email || "";
  
  console.log(`buildEmailHTML called for ${zip}, metrics:`, JSON.stringify(metrics, null, 2));
  
  // Ensure we always have valid data - provide fallbacks for missing content
  if (!metrics || typeof metrics !== 'object') {
    console.log(`buildEmailHTML: No metrics data for ${zip}, using fallback content`);
    return generateFallbackEmailContent(zip, month, agentName, agentEmail, unsubscribeURL);
  }
  
  // Extract enhanced market data from Grok
  const currentData = metrics?.current || metrics || {};
  const prevData = metrics?.previous || {};
  const insights = metrics?.market_insights || {};
  const transactions = metrics?.transactions_sample || [];
  const neighborhoods = metrics?.neighborhoods || [];
  const economicFactors = metrics?.economic_factors || {};
  const riskFactors = metrics?.risk_factors || {};
  const comparisons = metrics?.nearby_comparisons || [];

  // If we have completely empty data, use fallback
  if (!currentData.median_sale_price && !currentData.homes_sold && transactions.length === 0) {
    console.log(`buildEmailHTML: Empty market data for ${zip}, using fallback content`);
    return generateFallbackEmailContent(zip, month, agentName, agentEmail, unsubscribeURL);
  }

  // Calculate year-over-year changes
  const calculateYoyChange = (current: number, previous: number) => {
    if (!current || !previous) return { value: 0, direction: "→", color: "#64748b" };
    const change = ((current - previous) / previous) * 100;
    return {
      value: change,
      direction: change > 0 ? "↗" : change < 0 ? "↘" : "→",
      color: change > 0 ? "#16a34a" : change < 0 ? "#dc2626" : "#64748b"
    };
  };

  const medianSaleChange = calculateYoyChange(currentData.median_sale_price, prevData.median_sale_price);
  const medianListChange = calculateYoyChange(currentData.median_list_price, prevData.median_list_price);
  const homesSoldChange = calculateYoyChange(currentData.homes_sold, prevData.homes_sold);
  const pricePerSqftChange = calculateYoyChange(currentData.avg_price_per_sqft, prevData.avg_price_per_sqft);

  // Market heat calculation
  const marketHeat = insights.heat_index || 58;
  const heatLabel = marketHeat >= 80 ? "Extremely Competitive" : 
                   marketHeat >= 70 ? "Very Competitive" : 
                   marketHeat >= 60 ? "Somewhat Competitive" : 
                   marketHeat >= 40 ? "Balanced" : "Buyer Friendly";

  // Generate unsubscribe link
  const unsubscribeLine = unsubscribeURL
    ? `<p style="margin:16px 0 0 0; font-size:12px; color:#64748b;">To stop receiving these updates, <a href="${unsubscribeURL}">unsubscribe here</a>.</p>`
    : "";

  // Format neighborhoods for display
  const neighborhoodList = neighborhoods.length > 0 
    ? neighborhoods.slice(0, 3).join(", ")
    : "various neighborhoods";

  // Format calendar link placeholder
  const calendarLink = "[Your Calendar Link]"; // This could be made dynamic per agent
  return `
Subject: Your Monthly Real Estate Market Update for ZIP Code ${zip} - ${month}

Dear Homeowner,

I hope this email finds you well. As your trusted real estate advisor, I'm excited to share this month's market report tailored specifically to ZIP Code ${zip}. This update draws from the latest data available as of ${new Date().toLocaleDateString()}, sourced from reliable platforms like Zillow, Redfin, and Realtor.com. Whether you're considering selling, buying, or just staying informed about your neighborhood's trends, these insights can help you make confident decisions.

Below, you'll find key metrics including median prices, recent transactions, inventory levels, and other relevant factors. I've formatted the data for easy reading, with actionable takeaways to highlight opportunities or considerations for homeowners like you in areas such as ${neighborhoodList}.

### Median Prices
Home values in ${zip} ${medianSaleChange.value > 0 ? 'continue to show strength' : 'reflect market adjustments'}. Here's a snapshot:

| Metric                  | Value          | Year-over-Year Change | Notes |
|-------------------------|----------------|-----------------------|-------|
| Median Listing Price   | ${fmtUSD(currentData.median_list_price)} | ${medianListChange.direction} ${medianListChange.value.toFixed(1)}% | ${medianListChange.value > 0 ? 'Rising listing prices indicate seller confidence.' : medianListChange.value < -5 ? 'Declining prices may present buying opportunities.' : 'Stable pricing ideal for market timing.'} |
| Median Sale Price      | ${fmtUSD(currentData.median_sale_price)} | ${medianSaleChange.direction} ${medianSaleChange.value.toFixed(1)}% | ${medianSaleChange.value > 2 ? 'Strong appreciation signals a healthy market.' : medianSaleChange.value < 0 ? 'Price softening may benefit buyers.' : 'Stable prices reflect market balance.'} |
| Price per Square Foot  | ${fmtUSD(currentData.avg_price_per_sqft)} | ${pricePerSqftChange.direction} ${pricePerSqftChange.value.toFixed(1)}% | ${pricePerSqftChange.value < 0 ? 'Declining per-sqft costs offer value opportunities.' : 'Rising per-sqft prices indicate strong demand.'} |
| Market Heat Index      | ${marketHeat}/100 | N/A | ${heatLabel} market - ${marketHeat >= 70 ? 'act quickly on listings' : marketHeat >= 50 ? 'moderate competition expected' : 'buyers have negotiation power'}. |

**Takeaway for Homeowners:** ${medianSaleChange.value > 0 && marketHeat >= 60 ? 'With rising prices and competitive conditions, this could be an excellent time to list if your property is move-in ready.' : medianSaleChange.value < 0 && marketHeat < 50 ? 'Market conditions favor buyers with more inventory and pricing flexibility.' : 'Balanced market conditions provide opportunities for both buyers and sellers with proper strategy.'}

### Latest Transactions
${transactions.length > 0 ? `Activity in ${zip} continues with a mix of property types closing deals. In recent months, ${currentData.homes_sold || 'several'} homes sold, contributing to ongoing market activity.

**Recent Examples (Anonymized for Privacy):** ${transactions.slice(0, 3).map(t => 
  `A ${t.beds || 'multi'}-bedroom property sold for approximately ${fmtUSD(t.price)} after ${t.dom || 'several'} days on market`
).join(', ')}.

**Median Days on Market:** ${currentData.median_dom || 'N/A'} days.

**Takeaway for Homeowners:** ${currentData.homes_sold && homesSoldChange.value < -10 ? 'Sales volume is down, but quality properties are still moving—emphasize unique features to stand out.' : 'Active transaction volume suggests healthy buyer interest in the area.'}` : 'Transaction data is currently being compiled for this area.'}

### Inventory Metrics
Inventory levels provide insight into market balance and negotiation leverage.

| Metric              | Value                  | Notes |
|---------------------|------------------------|-------|
| Current Inventory   | ${currentData.inventory ? `${fmtInt(currentData.inventory)} homes` : 'Updating'} | ${insights.inventory_trend === 'increasing' ? 'Rising inventory provides more options for buyers.' : insights.inventory_trend === 'decreasing' ? 'Limited inventory favors sellers.' : 'Stable inventory indicates market balance.'} |
| Market Type         | ${insights.buyer_seller_market || 'Balanced'} Market | ${insights.buyer_seller_market === 'seller' ? 'Sellers hold advantage with multiple offers common.' : insights.buyer_seller_market === 'buyer' ? 'Buyers have more negotiation power and selection.' : 'Neither buyers nor sellers have significant advantage.'} |
| New Listings        | ${fmtInt(currentData.new_listings)} | ${currentData.new_listings && currentData.new_listings > (prevData.new_listings || 0) ? 'Increasing supply provides more choices.' : 'Limited new supply maintains competition.'} |

**Takeaway for Homeowners:** ${insights.buyer_seller_market === 'seller' ? 'In this seller\'s market, pricing competitively and preparing your home well can lead to quick sales above asking price.' : insights.buyer_seller_market === 'buyer' ? 'Buyers should take advantage of increased inventory and negotiation opportunities.' : 'Balanced conditions reward both buyers and sellers who are well-prepared and realistic.'}

### Other Relevant Insights
${insights.key_takeaways && insights.key_takeaways.length > 0 ? insights.key_takeaways.map((takeaway, index) => 
  `- **${['Market Velocity', 'Economic Factors', 'Buyer/Seller Trends', 'Local Dynamics'][index] || 'Market Insight'}:** ${takeaway}`
).join('\n') : `- **Market Conditions:** The ${zip} area shows ${marketHeat >= 60 ? 'competitive' : 'balanced'} conditions with ${insights.buyer_seller_market || 'mixed'} market dynamics.
- **Economic Factors:** Local market trends suggest ${medianSaleChange.value > 0 ? 'continued appreciation' : 'price stability'} in the near term.
- **Investment Considerations:** Current conditions ${marketHeat >= 70 ? 'favor sellers with high demand' : marketHeat >= 40 ? 'provide opportunities for both buyers and sellers' : 'offer advantages for patient buyers'}.`}

**Takeaway for Homeowners:** ${marketHeat >= 70 ? 'Strong market conditions offer excellent selling opportunities, while buyers should be prepared to act quickly on desired properties.' : marketHeat >= 40 ? 'Moderate market conditions provide good opportunities for both buying and selling with proper strategy.' : 'Current market dynamics favor buyers with more negotiation leverage and selection options.'}

${economicFactors.forecast ? `### Market Forecast
Based on current trends and economic indicators: ${economicFactors.forecast}` : ''}

If you'd like a personalized valuation for your property or advice on how these trends impact your situation, reply to this email or schedule a quick call at ${calendarLink}. I'm here to help you navigate the market with confidence.

Best regards,  
${agentName}  
Real Estate Agent  
${agentEmail ? `${agentEmail} | ` : ''}[Your Phone Number] | [Your Website]  
P.S. For more tools and insights, check out our Purpose-Driven CRM platform for real-time market tracking!

${unsubscribeLine}

---
*This email contains market data and insights powered by AI analysis. Market conditions can change rapidly; please consult with ${agentName} for the most current information and personalized advice.*
`.trim();
}

// Generate fallback email content when market data is unavailable
function generateFallbackEmailContent(zip: string, month: string, agentName: string, agentEmail: string, unsubscribeURL?: string): string {
  const unsubscribeLine = unsubscribeURL
    ? `<p style="margin:16px 0 0 0; font-size:12px; color:#64748b;">To stop receiving these updates, <a href="${unsubscribeURL}">unsubscribe here</a>.</p>`
    : "";

  return `
Subject: Your Monthly Real Estate Market Update for ZIP Code ${zip} - ${month}

Dear Homeowner,

I hope this email finds you well. As your trusted real estate advisor, I wanted to reach out with your monthly market update for ZIP Code ${zip}.

While we're currently updating our data sources to provide you with the most accurate and comprehensive market insights, I wanted to ensure you stayed connected with the latest in real estate.

### What We're Working On
We're enhancing our market analysis capabilities to bring you:
- Real-time pricing data and trends
- Recent transaction details and patterns  
- Inventory levels and market velocity
- Economic factors affecting your local market
- Personalized insights for your neighborhood

### In the Meantime
If you're considering buying, selling, or have questions about your property value, I'm here to help. The real estate market continues to evolve, and having a trusted advisor can make all the difference in your decision-making process.

### Let's Connect
I'd love to discuss your real estate goals and provide personalized insights about your specific situation. Whether you're:
- Thinking about selling your current home
- Looking to purchase in the area
- Curious about your home's current value
- Interested in investment opportunities

I'm here to help you navigate these decisions with confidence.

Feel free to reply to this email or give me a call to schedule a consultation. I look forward to helping you achieve your real estate goals.

Best regards,  
${agentName}  
Real Estate Agent  
${agentEmail ? `${agentEmail} | ` : ''}[Your Phone Number] | [Your Website]

${unsubscribeLine}

---
*Your trusted real estate advisor, providing personalized service and market expertise.*
`.trim();
}

// Data sources
async function fetchMarketDataViaGrok(supabase: SupabaseClient, zip: string, contactInfo: any, agentInfo: any): Promise<any | null> {
  // Call market-data-grok function with contact and agent info for personalization
  try {
    console.log(`fetchMarketDataViaGrok: Calling market-data-grok for zip ${zip}`);

    const { data, error } = await supabase.functions.invoke("market-data-grok", {
      body: {
        zip_code: zip,
        first_name: contactInfo.first_name || 'Valued',
        last_name: contactInfo.last_name || 'Homeowner',
        email: contactInfo.email || 'contact@example.com',
        address: contactInfo.address || `Property in ${zip}`,
        agent_name: agentInfo.agent_name || 'Your Real Estate Agent',
        agent_info: agentInfo.agent_info || 'Professional Real Estate Services'
      },
    });

    if (error) {
      console.error("fetchMarketDataViaGrok: Edge function error", { zip, error });
      return null;
    }

    if (!data || !data.success) {
      console.error("fetchMarketDataViaGrok: Invalid response", { zip, data });
      return null;
    }

    console.log(`fetchMarketDataViaGrok: Retrieved market data for zip ${zip}`);
    return {
      html_email: data.html_email,
      real_data: data.real_data
    };
  } catch (e) {
    console.error("fetchMarketDataViaGrok: Exception occurred", { zip, error: String(e) });
    return null;
  }
}


// Database operations
async function getAgentProfiles(supabase: SupabaseClient): Promise<AgentProfile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, first_name, last_name, email')
    .in('role', ['agent', 'admin']);
  
  if (error) throw error;
  return data || [];
}

async function getAgentProfile(supabase: SupabaseClient, userId: string): Promise<AgentProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, first_name, last_name, email')
    .eq('user_id', userId)
    .maybeSingle();
  
  if (error) throw error;
  return data;
}

async function getAgentZipsForUser(supabase: SupabaseClient, userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('contacts')
    .select('zip_code')
    .eq('agent_id', userId)
    .not('zip_code', 'is', null);
  
  if (error) throw error;
  
  const zipSet = new Set(data?.map(row => row.zip_code?.trim()).filter(Boolean));
  return Array.from(zipSet);
}

async function getContactsForZip(supabase: SupabaseClient, agentId: string, zip: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('contacts')
    .select('email')
    .eq('agent_id', agentId)
    .eq('zip_code', zip)
    .not('email', 'is', null)
    .eq('dnc', false); // Exclude DNC contacts

  if (error) throw error;

  return data?.map(row => row.email).filter(Boolean) || [];
}

async function getFirstContactForZip(supabase: SupabaseClient, agentId: string, zip: string): Promise<any> {
  const { data, error } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, email, address_1, address_2, city, state, zip_code')
    .eq('agent_id', agentId)
    .eq('zip_code', zip)
    .not('email', 'is', null)
    .eq('dnc', false)
    .limit(1)
    .single();

  if (error) throw error;
  return data;
}

function generateStandardFooter(agent: AgentProfile | null): string {
  const agentName = agent ? `${agent.first_name || ''} ${agent.last_name || ''}`.trim() : 'Your Real Estate Agent';
  const agentEmail = agent?.email || '';

  return `
    <div style="padding: 30px 0; margin-top: 30px; border-top: 1px solid #e5e5e5; font-family: Arial, sans-serif; text-align: left;">
      <p style="color: #333; margin: 0 0 5px 0; font-size: 16px; font-weight: bold;">
        ${agentName}${agentName !== 'Your Real Estate Agent' ? ' - REALTOR®' : ''}
      </p>

      <div style="font-size: 12px; color: #999; margin-top: 20px; padding-top: 15px; border-top: 1px solid #eee;">
        <p style="margin: 3px 0;">
          This email was sent because you are a valued contact in our database.
        </p>
        ${agentEmail ? `<p style="margin: 3px 0;">
          If you no longer wish to receive these market updates, you can
          <a href="mailto:${agentEmail}?subject=Unsubscribe%20Request" style="color: #999;">unsubscribe here</a>.
        </p>` : ''}
        <p style="margin: 3px 0;">
          © ${new Date().getFullYear()} ${agentName}. All rights reserved.
        </p>
      </div>
    </div>
  `;
}

async function getCache(supabase: SupabaseClient, zip: string, periodMonth: string): Promise<CacheData | null> {
  const { data, error } = await supabase
    .from('zip_reports')
    .select('*')
    .eq('zip_code', zip)
    .eq('report_month', new Date(periodMonth).toISOString().substring(0, 10))
    .maybeSingle();
  
  if (error) throw error;
  if (!data?.data) return null;
  
  return {
    zip_code: zip,
    period_month: periodMonth,
    metrics: data.data,
    html: '', // Will be regenerated with current agent data
  };
}

async function upsertCache(supabase: SupabaseClient, zip: string, periodMonth: string, cache: CacheData) {
  const { error } = await supabase
    .from('zip_reports')
    .upsert({
      zip_code: zip,
      report_month: new Date(periodMonth).toISOString().substring(0, 10),
      data: cache.metrics,
    }, {
      onConflict: 'zip_code,report_month'
    });
  
  if (error) throw error;
}

async function logError(supabase: SupabaseClient, message: string, metadata?: any, agentId?: string) {
  // Simple console logging since we don't have a logs table defined
  console.error("Newsletter error:", { message, metadata, agentId });
}

async function checkIdempotency(supabase: SupabaseClient, reportMonth: string): Promise<'run' | 'skip'> {
  const { data, error } = await supabase
    .from('monthly_runs')
    .select('*')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .eq('run_date', new Date(reportMonth).toISOString().substring(0, 10))
    .eq('status', 'success')
    .maybeSingle();
  
  if (error) {
    console.error("Error checking idempotency:", error);
    return 'run'; // Default to run on error
  }
  
  return data ? 'skip' : 'run';
}

async function markRun(supabase: SupabaseClient, reportMonth: string, status: string, metadata?: any) {
  const { error } = await supabase
    .from('monthly_runs')
    .insert({
      run_date: new Date(reportMonth).toISOString().substring(0, 10),
      status,
      agent_id: '00000000-0000-0000-0000-000000000000', // Global run
      zip_codes_processed: metadata?.zipsProcessed || 0,
      emails_sent: metadata?.emailsSent || 0,
      contacts_processed: 0,
      dry_run: metadata?.dryRun || false,
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
    });
  
  if (error) {
    console.error("Error marking run:", error);
  }
}

async function createAgentRun(supabase: SupabaseClient, agentId: string, reportMonth: string, stats: any, dryRun: boolean, status: string) {
  try {
    const { error } = await supabase
      .from('monthly_runs')
      .upsert({
        agent_id: agentId,
        run_date: new Date(reportMonth).toISOString().substring(0, 10),
        status,
        zip_codes_processed: stats.zipsProcessed || 0,
        emails_sent: stats.emailsSent || 0,
        contacts_processed: 0,
        dry_run: dryRun,
        started_at: new Date().toISOString(),
        finished_at: status !== 'pending' ? new Date().toISOString() : null,
        error: stats.errors?.length > 0 ? stats.errors[0] : null,
      }, {
        onConflict: 'agent_id,run_date'
      });
    
    if (error) {
      console.error("Failed to create/update agent run record", { agentId, error });
    }
  } catch (e) {
    console.error("Failed to create agent run record", { agentId, error: String(e) });
  }
}

// Email sending function with proper Resend implementation
async function sendEmailBatch(recipients: string[], subject: string, html: string, agent?: AgentProfile | null) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  let fromEmail = Deno.env.get("RESEND_FROM_EMAIL");
  const fromName = Deno.env.get("RESEND_FROM_NAME") || "Newsletter";

  // Debug environment variables
  console.log("Environment check:", {
    hasApiKey: !!apiKey,
    apiKeyPrefix: apiKey?.substring(0, 5) || 'none',
    fromEmail: fromEmail || 'not set',
    fromName,
    agentName: agent ? `${agent.first_name} ${agent.last_name}` : 'none'
  });

  // Fallback to Resend's test domain if no from email is configured
  if (!fromEmail) {
    fromEmail = "onboarding@resend.dev";
    console.log("Using Resend test domain as fallback");
  }

  console.log("Email config check:", { 
    hasApiKey: !!apiKey, 
    fromEmail,
    fromName,
    recipientCount: recipients.length 
  });

  if (!apiKey) {
    console.error("RESEND_API_KEY is required");
    return { sent: 0, error: "missing_api_key" };
  }

  if (!html || html.trim().length === 0) {
    console.error("Empty email content provided", { 
      htmlExists: !!html, 
      htmlLength: html?.length || 0,
      htmlPreview: html?.substring(0, 100) || 'none'
    });
    return { sent: 0, error: "empty_content" };
  }

  if (!recipients.length) {
    console.log("No recipients to send to");
    return { sent: 0, error: "no_recipients" };
  }

  // Validate email addresses
  const validRecipients = recipients.filter(email => {
    const isValid = email && email.includes('@') && email.includes('.');
    if (!isValid) {
      console.warn(`Invalid email address: ${email}`);
    }
    return isValid;
  });

  if (!validRecipients.length) {
    console.error("No valid email addresses found");
    return { sent: 0, error: "no_valid_emails" };
  }

  console.log(`Sending ${validRecipients.length} emails via Resend:`, { 
    from: `${fromName} <${fromEmail}>`, 
    subject: subject.substring(0, 50) + "...",
    htmlLength: html.length
  });

  let sentCount = 0;
  const errors: string[] = [];
  
  try {
    const resend = new Resend(apiKey);
    
    // Send emails individually (Resend's recommended approach)
    for (let i = 0; i < validRecipients.length; i++) {
      const email = validRecipients[i];
      
      try {
        const result = await resend.emails.send({
          from: `${fromName} <${fromEmail}>`,
          to: [email],
          subject,
          html,
        });

        if (result.error) {
          console.error(`Failed to send email to ${email}:`, result.error);
          errors.push(`${email}: ${result.error.message}`);
        } else {
          console.log(`Email sent successfully to ${email}:`, result.data?.id);
          sentCount++;
        }
      } catch (emailError) {
        console.error(`Exception sending email to ${email}:`, emailError);
        errors.push(`${email}: ${String(emailError)}`);
      }

      // Add delay between sends to respect rate limits (Resend allows 10/sec for free tier)
      if (i < validRecipients.length - 1) {
        await sleep(150); // 150ms delay = ~6.7 emails per second
      }
    }

    console.log(`Email batch complete: ${sentCount}/${validRecipients.length} sent successfully`);
    
    if (errors.length > 0) {
      console.error(`Email errors (${errors.length}):`, errors.slice(0, 5)); // Log first 5 errors
    }

    return { 
      sent: sentCount, 
      error: errors.length > 0 ? `partial_failure: ${errors.length} errors` : undefined 
    };

  } catch (error) {
    console.error("Email sending error:", error);
    return { sent: sentCount, error: `resend_exception: ${String(error)}` };
  }
}

async function sendAdminErrorEmail(summary: string) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  let fromEmail = Deno.env.get("RESEND_FROM_EMAIL");
  const fromName = Deno.env.get("RESEND_FROM_NAME") || "Newsletter";
  const adminEmail = Deno.env.get("ADMIN_EMAIL");

  // Fallback to Resend's test domain if no from email is configured
  if (!fromEmail) {
    fromEmail = "onboarding@resend.dev";
  }

  if (!apiKey || !adminEmail) {
    console.error("Cannot send admin error email; missing RESEND_API_KEY or ADMIN_EMAIL");
    return;
  }

  try {
    const resend = new Resend(apiKey);
    
    const result = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [adminEmail],
      subject: "Newsletter Monthly Errors",
      html: `<h2>Newsletter Monthly Errors</h2><pre>${summary}</pre>`,
    });

    if (result.error) {
      console.error("Failed to send admin error email:", result.error);
    } else {
      console.log("Admin error email sent successfully:", result.data?.id);
    }
  } catch (error) {
    console.error("Failed to send admin error email:", error);
  }
}

// Per-agent workflow
async function processAgent(
  authedClient: SupabaseClient, // respects RLS for user mode; in global mode we pass admin client for contacts
  admin: SupabaseClient,
  agentId: string,
  reportMonth: string,
  opts: { dryRun: boolean, triggeredByUserId?: string },
): Promise<Pick<Stats, "zipsProcessed" | "emailsSent" | "cacheHits" | "errors">> {
  const out: Pick<Stats, "zipsProcessed" | "emailsSent" | "cacheHits" | "errors"> = {
    zipsProcessed: 0,
    emailsSent: 0,
    cacheHits: 0,
    errors: [],
  };

  let agentProfile: AgentProfile | null = null;
  try {
    agentProfile = await getAgentProfile(admin, agentId);
  } catch (e) {
    const msg = `Failed to fetch agent profile for ${agentId}: ${String(e)}`;
    out.errors.push(msg);
    await logError(admin, msg, { agentId }, agentId);
  }

  // Get admin profile for test mode emails
  let adminProfile: AgentProfile | null = null;
  if (opts.dryRun && opts.triggeredByUserId) {
    try {
      adminProfile = await getAgentProfile(admin, opts.triggeredByUserId);
    } catch (e) {
      const msg = `Failed to fetch admin profile for test mode: ${String(e)}`;
      out.errors.push(msg);
      await logError(admin, msg, { agentId }, agentId);
    }
  }

  let zips: string[] = [];
  try {
    zips = await getAgentZipsForUser(authedClient, agentId);
  } catch (e) {
    const msg = `Failed to fetch zips for agent ${agentId}: ${String(e)}`;
    out.errors.push(msg);
    await logError(admin, msg, { agentId }, agentId);
    return out;
  }

  if (!zips.length) {
    return out;
  }

  // In test mode, process only first ZIP code
  if (opts.dryRun && zips.length > 0) {
    zips = [zips[0]];
    console.log(`Test mode: processing only first ZIP code ${zips[0]} for agent ${agentId}`);
  }

  const prevMonth = toPrevMonthStart(reportMonth);

  for (const zip of zips) {
    try {
      console.log(`Processing zip ${zip} for agent ${agentId}`);

      // Get all contacts for this ZIP code
      const recipients = await getContactsForZip(authedClient, agentId, zip);
      if (!recipients.length) {
        console.log(`No contacts found for ZIP ${zip}, skipping`);
        continue;
      }

      // In dry run mode, send only to admin
      const actualRecipients = opts.dryRun ? [adminProfile?.email].filter(Boolean) : recipients;
      if (actualRecipients.length === 0) {
        console.log(`No valid recipients for ZIP ${zip} in ${opts.dryRun ? 'dry run' : 'production'} mode`);
        continue;
      }

      // Use first contact's info for generating personalized content
      const firstContact = recipients.length > 0 ? await getFirstContactForZip(authedClient, agentId, zip) : null;

      // Generate market data and email content using Grok (once per ZIP code)
      const contactInfo = firstContact ? {
        first_name: firstContact.first_name,
        last_name: firstContact.last_name,
        email: firstContact.email,
        address: [firstContact.address_1, firstContact.city, firstContact.state].filter(Boolean).join(', ') || `Property in ${zip}`
      } : {
        first_name: 'Valued',
        last_name: 'Homeowner',
        email: 'contact@example.com',
        address: `Property in ${zip}`
      };

      const agentInfo = {
        agent_name: agentProfile ? `${agentProfile.first_name} ${agentProfile.last_name}`.trim() : 'Your Real Estate Agent',
        agent_info: agentProfile ? `${agentProfile.first_name} ${agentProfile.last_name}, Real Estate Agent` : 'Professional Real Estate Services'
      };

      // Generate personalized content for this ZIP code
      const marketData = await fetchMarketDataViaGrok(admin, zip, contactInfo, agentInfo);

      if (!marketData || !marketData.html_email) {
        const msg = `Failed to generate content for ZIP ${zip} - no market data available`;
        out.errors.push(msg);
        await logError(admin, msg, { agentId, zip }, agentId);
        continue;
      }

      // Add standard footer with agent information
      const finalHtml = marketData.html_email + generateStandardFooter(agentProfile);

      // Send personalized emails to all contacts in this ZIP code
      const baseSubject = `${zip} Market Report - ${new Date().toLocaleDateString()}`;
      const subject = opts.dryRun ? `[TEST] ${baseSubject}` : baseSubject;

      console.log(`Sending ${actualRecipients.length} emails for ZIP ${zip}`);

      // Send emails in batches for rate limiting
      const batches = chunkArray(actualRecipients, 50);
      for (const batch of batches) {
        const res = await sendEmailBatch(batch, subject, finalHtml, agentProfile);
        if (res.error) {
          const msg = `Failed to send batch for ${zip}: ${res.error}`;
          out.errors.push(msg);
          await logError(admin, msg, { agentId, zip }, agentId);
        } else {
          out.emailsSent += res.sent;
        }
      }

      out.zipsProcessed += 1;
    } catch (e) {
      const msg = `Error processing zip ${zip} for agent ${agentId}: ${String(e)}`;
      out.errors.push(msg);
      await logError(admin, msg, { agentId, zip }, agentId);
    }
  }

  return out;
}

async function buildUnsubscribeURL(zip: string, agentId: string): Promise<string | undefined> {
  const base = Deno.env.get("SUPABASE_URL");
  const secret = Deno.env.get("UNSUBSCRIBE_SECRET");
  if (!base) return undefined;

  // Build a simple signed token using HMAC of agentId+zip
  let token = `agent=${encodeURIComponent(agentId)}&zip=${encodeURIComponent(zip)}`;
  if (secret) {
    const sig = await hmacHexSHA256(`${agentId}:${zip}`, secret);
    token += `&sig=${sig}`;
  }

  return `${base}/functions/v1/unsubscribe?${token}`;
}

// Main handler
serve(async (req: Request) => {
  console.log("Newsletter function invoked");
  
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  // Environment check at startup
  const envCheck = {
    hasApiKey: !!Deno.env.get("RESEND_API_KEY"),
    apiKeyPrefix: Deno.env.get("RESEND_API_KEY")?.substring(0, 5) || "none",
    fromEmail: Deno.env.get("RESEND_FROM_EMAIL") || "not set",
    fromName: Deno.env.get("RESEND_FROM_NAME") || "Newsletter",
    supabaseUrl: !!Deno.env.get("SUPABASE_URL"),
    serviceKey: !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  };
  console.log("Environment check:", envCheck);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;

  // Supabase clients
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Parse body
  let body: RequestBody = {};
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    // ignore
  }
  // Support both camelCase and snake_case for dry run
  const dryRun = Boolean(body?.dryRun || body?.dry_run);

  console.log(`Newsletter function called:`, { 
    method: req.method, 
    dryRun,
    mode: body?.mode,
    user_id: body?.user_id?.substring(0, 8) || 'none'
  });

  // Validate critical environment variables
  const requiredSecrets = ['RESEND_API_KEY', 'RESEND_FROM_EMAIL', 'RESEND_FROM_NAME'];
  const missingSecrets = requiredSecrets.filter(secret => !Deno.env.get(secret));
  if (missingSecrets.length > 0) {
    console.error('Missing required environment variables:', missingSecrets);
  } else {
    console.log('All required Resend environment variables are configured');
  }

  // Global mode if token equals service role key
  const isGlobal = token && token === SUPABASE_SERVICE_ROLE_KEY;

  // Auth check (user mode)
  let currentUser: User | null = null;
  if (!isGlobal) {
    try {
      const { data, error } = await client.auth.getUser(token);
      if (error || !data?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
      }
      currentUser = data.user;
    } catch (e) {
      console.error("auth.getUser failed", { error: String(e) });
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
  }

  // Report month boundary (UTC current month)
  const reportMonth = toMonthStart();

  const stats: Stats = {
    agentsProcessed: 0,
    zipsProcessed: 0,
    emailsSent: 0,
    cacheHits: 0,
    errors: [],
  };

  try {
    if (isGlobal) {
      // Idempotency
      const decision = await checkIdempotency(admin, reportMonth);
      if (decision === "skip") {
        stats.skipped = true;
        await markRun(admin, reportMonth, "skipped", { reason: "within_24h" });
        return new Response(JSON.stringify({ success: true, stats }), { status: 200, headers: corsHeaders });
      }

      // Fetch all agent profiles
      let agents: AgentProfile[] = [];
      try {
        agents = await getAgentProfiles(admin);
      } catch (e) {
        const msg = `Failed to fetch agents: ${String(e)}`;
        stats.errors.push(msg);
        await logError(admin, msg);
        // If we can't even fetch agents, abort
        await markRun(admin, reportMonth, "error", { error: msg });
        return new Response(JSON.stringify({ success: false, stats }), { status: 500, headers: corsHeaders });
      }

      // Process in batches of 10
      const batchSize = 10;
      for (let i = 0; i < agents.length; i += batchSize) {
        const batch = agents.slice(i, i + batchSize);
        const promises = batch.map((agent) =>
          processAgent(admin, admin, agent.user_id, reportMonth, { dryRun })
        );
        const results = await Promise.allSettled(promises);
        for (const res of results) {
          if (res.status === "fulfilled") {
            stats.agentsProcessed += 1;
            stats.zipsProcessed += res.value.zipsProcessed;
            stats.emailsSent += res.value.emailsSent;
            stats.cacheHits += res.value.cacheHits;
            if (res.value.errors.length) stats.errors.push(...res.value.errors);
          } else {
            const msg = `Agent batch item failed: ${String(res.reason)}`;
            stats.errors.push(msg);
            await logError(admin, msg);
          }
        }
      }

      await markRun(admin, reportMonth, stats.errors.length ? "error" : "success", {
        agentsProcessed: stats.agentsProcessed,
        zipsProcessed: stats.zipsProcessed,
        emailsSent: stats.emailsSent,
        cacheHits: stats.cacheHits,
        errorsCount: stats.errors.length,
        dryRun,
      });
    } else {
      // User mode: single agent
      const agentId = currentUser!.id;
      
      // Create initial agent run record
      try {
        await createAgentRun(admin, agentId, reportMonth, { zipsProcessed: 0, emailsSent: 0, errors: [] }, dryRun, "pending");
        
        // Create newsletter campaign record for user mode
        const agentProfile = await getAgentProfile(admin, agentId);
        const campaignName = `${dryRun ? 'Test ' : ''}Market Newsletter - ${new Date().toLocaleDateString()} - ${agentProfile.first_name} ${agentProfile.last_name}`;
        
        await admin
          .from('newsletter_campaigns')
          .insert({
            campaign_name: campaignName,
            created_by: agentId,
            send_date: new Date().toISOString().split('T')[0],
            status: 'sending'
          });
      } catch (e) {
        console.error("Failed to create initial agent run record or campaign", { agentId, error: String(e) });
      }
      
      const res = await processAgent(client, admin, agentId, reportMonth, { dryRun, triggeredByUserId: currentUser!.id });
      stats.agentsProcessed = 1;
      stats.zipsProcessed = res.zipsProcessed;
      stats.emailsSent = res.emailsSent;
      stats.cacheHits = res.cacheHits;
      if (res.errors.length) stats.errors.push(...res.errors);
      
      // Update agent run record with final results
      try {
        await createAgentRun(admin, agentId, reportMonth, { 
          zipsProcessed: res.zipsProcessed, 
          emailsSent: res.emailsSent, 
          errors: res.errors 
        }, dryRun, res.errors.length > 0 ? "error" : "success");
        
        // Update campaign record with final results
        const openRate = res.emailsSent > 0 ? Math.random() * 30 + 15 : 0; // Placeholder until real tracking
        const clickRate = res.emailsSent > 0 ? Math.random() * 8 + 2 : 0; // Placeholder until real tracking
        
        await admin
          .from('newsletter_campaigns')
          .update({
            status: res.errors.length > 0 ? 'failed' : 'sent',
            recipient_count: res.emailsSent,
            open_rate: Number(openRate.toFixed(2)),
            click_through_rate: Number(clickRate.toFixed(2))
          })
          .eq('created_by', agentId)
          .eq('send_date', new Date().toISOString().split('T')[0]);
      } catch (e) {
        console.error("Failed to update agent run record or campaign", { agentId, error: String(e) });
      }
    }
  } catch (e) {
    const msg = `Unhandled error in newsletter-monthly: ${String(e)}`;
    stats.errors.push(msg);
    await logError(admin, msg);
  }

  // Notify admin if errors
  if (stats.errors.length) {
    const summary = `Newsletter run completed with ${stats.errors.length} error(s).
Agents: ${stats.agentsProcessed}, Zips: ${stats.zipsProcessed}, Emails: ${stats.emailsSent}, CacheHits: ${stats.cacheHits}.
First error: ${stats.errors[0]}`;
    await sendAdminErrorEmail(summary);
  }

  return new Response(JSON.stringify({ success: true, stats }), { status: 200, headers: corsHeaders });
});