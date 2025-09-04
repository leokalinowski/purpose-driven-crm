import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  dryRun?: boolean;
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
  const unsubscribeLine = unsubscribeURL
    ? `<p style="margin:16px 0 0 0; font-size:12px; color:#64748b;">To stop receiving these updates, <a href="${unsubscribeURL}">unsubscribe here</a>.</p>`
    : "";

  // Extract market insights and transactions from Grok data structure
  const insights = metrics?.market_insights || {};
  const transactions = metrics?.transactions_sample || [];
  const heatIndex = insights.heat_index || 60;
  const yoyChange = insights.yoy_price_change || 0;
  const marketType = insights.buyer_seller_market || "balanced";
  const inventoryTrend = insights.inventory_trend || "stable";
  const keyTakeaways = insights.key_takeaways || [];

  // Generate heat index color
  const heatColor = heatIndex >= 80 ? "#dc2626" : heatIndex >= 60 ? "#ea580c" : heatIndex >= 40 ? "#ca8a04" : "#16a34a";
  const heatLabel = heatIndex >= 80 ? "Very Hot" : heatIndex >= 60 ? "Hot" : heatIndex >= 40 ? "Warm" : "Cool";

  // Generate YoY change styling
  const yoyColor = yoyChange > 0 ? "#16a34a" : yoyChange < 0 ? "#dc2626" : "#64748b";
  const yoyIcon = yoyChange > 0 ? "↗" : yoyChange < 0 ? "↘" : "→";

  // Market type styling
  const marketColor = marketType === "seller" ? "#dc2626" : marketType === "buyer" ? "#16a34a" : "#ca8a04";
  
  return `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${zip} Monthly Real Estate Newsletter — ${month}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body style="font-family:ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#0f172a; background:#f8fafc; margin:0; padding:20px;">
    
    <!-- Main Container -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 25px rgba(0,0,0,0.1);">
      
      <!-- Header Section -->
      <tr>
        <td style="background:linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color:white; padding:32px 24px; text-align:center;">
          <h1 style="margin:0 0 8px 0;font-size:28px;font-weight:700;letter-spacing:-0.5px;">${zip} Market Report</h1>
          <p style="margin:0;font-size:16px;opacity:0.9;">${month} • ${agentName}</p>
        </td>
      </tr>

      <!-- Agent Introduction -->
      <tr>
        <td style="padding:24px;">
          <div style="background:#f8fafc;border-left:4px solid #3b82f6;padding:16px;border-radius:8px;margin-bottom:24px;">
            <p style="margin:0;font-size:16px;color:#374151;line-height:1.6;">
              <strong>Hello from ${agentName}!</strong><br>
              Your local real estate market continues to evolve. Here's your personalized ${month} market analysis for ${zip}, including insights powered by the latest market data and AI analysis.
            </p>
          </div>
        </td>
      </tr>

      <!-- Market Heat Index -->
      <tr>
        <td style="padding:0 24px 24px 24px;">
          <div style="background:${heatColor}15;border:2px solid ${heatColor}30;border-radius:12px;padding:20px;text-align:center;">
            <h3 style="margin:0 0 8px 0;color:${heatColor};font-size:18px;font-weight:700;">Market Heat Index</h3>
            <div style="font-size:36px;font-weight:800;color:${heatColor};margin:8px 0;">${heatIndex}/100</div>
            <p style="margin:0;color:#374151;font-weight:600;">${heatLabel} Market</p>
          </div>
        </td>
      </tr>

      <!-- Key Metrics Table -->
      <tr>
        <td style="padding:0 24px 24px 24px;">
          <h3 style="margin:0 0 16px 0;font-size:20px;font-weight:700;color:#111827;">📊 Key Market Metrics</h3>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
            <tr style="background:#f9fafb;">
              <td style="padding:16px;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;">Metric</td>
              <td style="padding:16px;font-weight:600;color:#374151;text-align:right;border-bottom:1px solid #e5e7eb;">Value</td>
            </tr>
            <tr>
              <td style="padding:16px;border-bottom:1px solid #f3f4f6;">Median Sale Price</td>
              <td style="padding:16px;text-align:right;font-weight:600;color:#059669;border-bottom:1px solid #f3f4f6;">${fmtUSD(metrics.median_sale_price)}</td>
            </tr>
            <tr>
              <td style="padding:16px;border-bottom:1px solid #f3f4f6;">Median List Price</td>
              <td style="padding:16px;text-align:right;font-weight:600;border-bottom:1px solid #f3f4f6;">${fmtUSD(metrics.median_list_price)}</td>
            </tr>
            <tr>
              <td style="padding:16px;border-bottom:1px solid #f3f4f6;">Homes Sold</td>
              <td style="padding:16px;text-align:right;font-weight:600;color:#dc2626;border-bottom:1px solid #f3f4f6;">${fmtInt(metrics.homes_sold)}</td>
            </tr>
            <tr>
              <td style="padding:16px;border-bottom:1px solid #f3f4f6;">New Listings</td>
              <td style="padding:16px;text-align:right;font-weight:600;border-bottom:1px solid #f3f4f6;">${fmtInt(metrics.new_listings)}</td>
            </tr>
            <tr>
              <td style="padding:16px;border-bottom:1px solid #f3f4f6;">Median Days on Market</td>
              <td style="padding:16px;text-align:right;font-weight:600;color:#7c3aed;border-bottom:1px solid #f3f4f6;">${fmtInt(metrics.median_dom)} days</td>
            </tr>
            <tr>
              <td style="padding:16px;border-bottom:1px solid #f3f4f6;">Price per Sq Ft</td>
              <td style="padding:16px;text-align:right;font-weight:600;border-bottom:1px solid #f3f4f6;">${fmtUSD(metrics.avg_price_per_sqft)}</td>
            </tr>
            <tr>
              <td style="padding:16px;">Current Inventory</td>
              <td style="padding:16px;text-align:right;font-weight:600;color:#ea580c;">${fmtInt(metrics.inventory)} homes</td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Market Analysis -->
      <tr>
        <td style="padding:0 24px 24px 24px;">
          <h3 style="margin:0 0 16px 0;font-size:20px;font-weight:700;color:#111827;">📈 Market Analysis</h3>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td style="width:33%;padding-right:8px;">
                <div style="background:#f0f9ff;border:1px solid #0ea5e9;border-radius:8px;padding:16px;text-align:center;">
                  <div style="font-size:14px;color:#0369a1;font-weight:600;margin-bottom:4px;">YoY Price Change</div>
                  <div style="font-size:20px;font-weight:800;color:${yoyColor};">${yoyIcon} ${yoyChange > 0 ? '+' : ''}${yoyChange.toFixed(1)}%</div>
                </div>
              </td>
              <td style="width:33%;padding:0 4px;">
                <div style="background:#f0fdf4;border:1px solid #22c55e;border-radius:8px;padding:16px;text-align:center;">
                  <div style="font-size:14px;color:#15803d;font-weight:600;margin-bottom:4px;">Market Type</div>
                  <div style="font-size:20px;font-weight:800;color:${marketColor};text-transform:capitalize;">${marketType}</div>
                </div>
              </td>
              <td style="width:33%;padding-left:8px;">
                <div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:16px;text-align:center;">
                  <div style="font-size:14px;color:#92400e;font-weight:600;margin-bottom:4px;">Inventory</div>
                  <div style="font-size:20px;font-weight:800;color:#d97706;text-transform:capitalize;">${inventoryTrend}</div>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Recent Transactions -->
      ${transactions.length > 0 ? `
      <tr>
        <td style="padding:0 24px 24px 24px;">
          <h3 style="margin:0 0 16px 0;font-size:20px;font-weight:700;color:#111827;">🏠 Recent Sales Examples</h3>
          <div style="background:#f9fafb;border-radius:8px;padding:16px;">
            ${transactions.slice(0, 4).map((t: any) => `
              <div style="padding:12px 0;border-bottom:1px solid #e5e7eb;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td>
                      <div style="font-weight:600;color:#111827;">${fmtUSD(t.price)}</div>
                      <div style="font-size:14px;color:#6b7280;">${t.beds} bed, ${t.baths} bath • ${fmtInt(t.sqft)} sq ft</div>
                    </td>
                    <td style="text-align:right;">
                      <div style="font-size:14px;color:#6b7280;">${t.dom} days</div>
                      <div style="font-size:12px;color:#9ca3af;">on market</div>
                    </td>
                  </tr>
                </table>
              </div>
            `).join('')}
          </div>
        </td>
      </tr>
      ` : ''}

      <!-- Key Insights -->
      ${keyTakeaways.length > 0 ? `
      <tr>
        <td style="padding:0 24px 24px 24px;">
          <h3 style="margin:0 0 16px 0;font-size:20px;font-weight:700;color:#111827;">💡 Key Market Insights</h3>
          <div style="background:#fef7ff;border:1px solid #d946ef;border-radius:8px;padding:20px;">
            ${keyTakeaways.slice(0, 4).map((takeaway: string) => `
              <div style="margin-bottom:12px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="width:20px;vertical-align:top;padding-right:12px;">
                      <div style="background:#d946ef;color:white;border-radius:50%;width:20px;height:20px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;">•</div>
                    </td>
                    <td style="vertical-align:top;">
                      <p style="margin:0;color:#374151;line-height:1.5;">${takeaway}</p>
                    </td>
                  </tr>
                </table>
              </div>
            `).join('')}
          </div>
        </td>
      </tr>
      ` : ''}

      <!-- Call to Action -->
      <tr>
        <td style="padding:0 24px 32px 24px;">
          <div style="background:linear-gradient(135deg, #059669 0%, #10b981 100%);border-radius:12px;padding:24px;text-align:center;color:white;">
            <h3 style="margin:0 0 8px 0;font-size:20px;font-weight:700;">Thinking of Buying or Selling?</h3>
            <p style="margin:0 0 16px 0;font-size:16px;opacity:0.9;">Get a personalized market analysis and expert guidance from ${agentName}</p>
            ${agentEmail ? `
            <a href="mailto:${agentEmail}?subject=Market Analysis Request for ${zip}" style="display:inline-block;background:white;color:#059669;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">Contact Me Today</a>
            ` : ''}
          </div>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="padding:20px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;">
          <div style="text-align:center;">
            <p style="margin:0 0 8px 0;font-size:14px;color:#6b7280;font-weight:600;">${agentName}</p>
            ${agentEmail ? `<p style="margin:0 0 16px 0;font-size:14px;color:#6b7280;">📧 ${agentEmail}</p>` : ''}
            <p style="margin:0 0 8px 0;font-size:12px;color:#9ca3af;">
              Market data powered by AI analysis • Report generated ${new Date().toLocaleDateString()}
            </p>
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              You're receiving this because you're in our database for ${zip}. 
              ${Deno.env.get("COMPANY_PHYSICAL_ADDRESS") ? `Business address: ${Deno.env.get("COMPANY_PHYSICAL_ADDRESS")}` : ''}
            </p>
            ${unsubscribeLine}
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>
`.trim();
}

// Data sources
async function fetchMarketDataViaGrok(supabase: SupabaseClient, zip: string, currentMonth: string): Promise<any | null> {
  // Call new edge function 'fetch-market-data-grok' 
  try {
    console.log(`fetchMarketDataViaGrok: Calling fetch-market-data-grok for zip ${zip}`);
    
    const { data, error } = await supabase.functions.invoke("fetch-market-data-grok", {
      body: { 
        zip_code: zip, 
        period_month: currentMonth.slice(0, 7) // Convert to YYYY-MM format
      },
    });
    
    if (error) {
      console.error("fetchMarketDataViaGrok: Edge function error", { zip, error });
      return null; // signal fallback
    }
    
    if (!data || !data.success || !data.data) {
      console.error("fetchMarketDataViaGrok: Invalid data format", { zip, data });
      return null;
    }
    
    console.log(`fetchMarketDataViaGrok: Retrieved market data for zip ${zip}`);
    return data.data;
  } catch (e) {
    console.error("fetchMarketDataViaGrok: Exception occurred", { zip, error: String(e) });
    return null; // signal fallback
  }
}

async function fetchTransactionsViaApifyFallback(zip: string, currentMonth: string) {
  // Fallback: attempt to run user-provided actor/task via env vars
  // Tries APIFY_TASK_ID first, then APIFY_ACTOR_ID
  const token = Deno.env.get("APIFY_API_TOKEN");
  if (!token) {
    console.log("No APIFY_API_TOKEN configured, skipping Apify fallback");
    return [];
  }

  const taskId = Deno.env.get("APIFY_TASK_ID");
  const actorId = Deno.env.get("APIFY_ACTOR_ID");
  if (!taskId && !actorId) {
    console.log("No APIFY_TASK_ID or APIFY_ACTOR_ID configured, skipping Apify fallback");
    return [];
  }

  console.log(`Fallback: trying Apify for ${zip} via ${taskId ? 'task' : 'actor'}`);

  let runUrl: string;
  if (taskId) {
    runUrl = `https://api.apify.com/v2/actor-tasks/${taskId}/run-sync?token=${token}`;
  } else {
    runUrl = `https://api.apify.com/v2/acts/${actorId}/run-sync?token=${token}`;
  }

  const input = {
    location: zip,
    maxItems: 50,
    type: 'sold'
  };

  try {
    const response = await fetch(runUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      console.error(`Apify run failed: ${response.statusText}`);
      return [];
    }

    const result = await response.json();
    const items = result.items || [];
    
    console.log(`Apify returned ${items.length} items for ${zip}`);
    return items;
  } catch (error) {
    console.error("Apify fallback error:", error);
    return [];
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

// Email sending
async function sendEmailBatch(bcc: string[], subject: string, html: string, agent?: AgentProfile | null) {
  const apiKey = Deno.env.get("SENDGRID_API_KEY");
  const fromEmail = Deno.env.get("SENDGRID_FROM_EMAIL");
  const fromName = Deno.env.get("SENDGRID_FROM_NAME") || "Newsletter";

  if (!apiKey || !fromEmail) {
    console.error("SendGrid configuration missing (SENDGRID_API_KEY or SENDGRID_FROM_EMAIL)");
    return { sent: 0, error: "missing_sendgrid_config" };
  }

  const toEmail = agent?.email || fromEmail;

  const payload = {
    personalizations: [
      {
        to: [{ email: toEmail }],
        bcc: bcc.map((email) => ({ email })),
        subject,
      },
    ],
    from: { email: fromEmail, name: fromName },
    content: [{ type: "text/html", value: html }],
  };

  const resp = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    console.error("SendGrid send failed", { status: resp.status, text });
    return { sent: 0, error: `sendgrid_${resp.status}` };
  }

  return { sent: bcc.length };
}

async function sendAdminErrorEmail(summary: string) {
  const apiKey = Deno.env.get("SENDGRID_API_KEY");
  const fromEmail = Deno.env.get("SENDGRID_FROM_EMAIL");
  const fromName = Deno.env.get("SENDGRID_FROM_NAME") || "Newsletter";
  const adminEmail = Deno.env.get("ADMIN_EMAIL");

  if (!apiKey || !fromEmail || !adminEmail) {
    console.error("Cannot send admin error email; missing SENDGRID or ADMIN_EMAIL");
    return;
  }

  const payload = {
    personalizations: [{ to: [{ email: adminEmail }], subject: "Newsletter Monthly Errors" }],
    from: { email: fromEmail, name: fromName },
    content: [{ type: "text/plain", value: summary }],
  };

  const resp = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    console.error("Failed to send admin error email", { status: resp.status, text });
  }
}

// Per-agent workflow
async function processAgent(
  authedClient: SupabaseClient, // respects RLS for user mode; in global mode we pass admin client for contacts
  admin: SupabaseClient,
  agentId: string,
  reportMonth: string,
  opts: { dryRun: boolean },
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

  const prevMonth = toPrevMonthStart(reportMonth);

  for (const zip of zips) {
    try {
      // Cache check
      let cache = await getCache(admin, zip, reportMonth);
      if (!cache) {
        // Fetch market data using Grok API
        let marketData = await fetchMarketDataViaGrok(admin, zip, reportMonth);
        if (marketData === null) {
          // If Grok fails, create fallback data
          marketData = {
            zip_code: zip,
            period_month: reportMonth.slice(0, 7),
            median_sale_price: null,
            median_list_price: null,
            homes_sold: null,
            new_listings: null,
            inventory: null,
            median_dom: null,
            avg_price_per_sqft: null,
            market_insights: {
              key_takeaways: ['Market data temporarily unavailable. Please check back later.']
            },
            transactions_sample: []
          };
        }
        // Throttle API calls
        await sleep(1000);

        // Skip zips with no data unless it's a dry run
        if (!marketData || (!marketData.median_sale_price && !marketData.homes_sold && marketData.market_insights?.key_takeaways?.[0]?.includes('unavailable'))) {
          continue;
        }

        // Get previous month's data for comparison (if available)
        let prevMetrics: any = null;
        try {
          const prevCache = await getCache(admin, zip, prevMonth);
          prevMetrics = prevCache?.metrics ?? null;
        } catch (e) {
          // not critical
          await logError(admin, "Failed to get previous month cache for comparison", { zip, prevMonth, error: String(e) }, agentId);
        }

        // Build HTML with agent personalization and unsubscribe link
        const unsubscribeURL = await buildUnsubscribeURL(zip, agentId);
        const html = buildEmailHTML(zip, reportMonth, marketData, agentProfile, unsubscribeURL);

        cache = {
          zip_code: zip,
          period_month: reportMonth,
          metrics: marketData, // Store the full Grok data as metrics
          prev_comparison: prevMetrics ? compareMetrics(marketData, prevMetrics) : undefined,
          html,
        };

        await upsertCache(admin, zip, reportMonth, cache);
      } else {
        out.cacheHits += 1;
      }

      // Send emails
      const recipients = await getContactsForZip(authedClient, agentId, zip);
      if (!recipients.length) {
        // skip zips with no contacts
        continue;
      }

      const subject = `${zip} Monthly Real Estate Newsletter – ${new Date().toLocaleDateString()}`;
      if (opts.dryRun) {
        await logError(admin, "Dry run: skipping send", { agentId, zip, recipients: recipients.length }, agentId);
      } else {
        const batches = chunkArray(recipients, 100);
        for (const batch of batches) {
          const res = await sendEmailBatch(batch, subject, cache.html, agentProfile);
          if (res.error) {
            const msg = `Failed to send batch for ${zip}: ${res.error}`;
            out.errors.push(msg);
            await logError(admin, msg, { agentId, zip }, agentId);
          } else {
            out.emailsSent += res.sent;
          }
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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

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
  const dryRun = Boolean(body?.dryRun);

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
      } catch (e) {
        console.error("Failed to create initial agent run record", { agentId, error: String(e) });
      }
      
      const res = await processAgent(client, admin, agentId, reportMonth, { dryRun });
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
      } catch (e) {
        console.error("Failed to update agent run record", { agentId, error: String(e) });
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