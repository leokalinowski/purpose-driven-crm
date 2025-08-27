
/**
 * Supabase Edge Function: newsletter-monthly
 *
 * Monthly real estate newsletter automation with:
 * - Supabase auth via incoming Authorization header (user mode) or service role token (global mode)
 * - Global mode batching per agent with idempotency (public.monthly_runs)
 * - Per-agent ZIP discovery from contacts, caching with zip_reports
 * - Historical comparison vs previous month's cache
 * - Apify fallback if fetch-zip-transactions fails
 * - Dry-run support
 * - Batched email sending via SendGrid (100 recipients per batch, BCC)
 * - Error logging into public.logs
 *
 * Notes:
 * - This function uses two Supabase clients:
 *   - "client": anon key + incoming Authorization (respects RLS for user mode)
 *   - "admin": service role key (bypasses RLS; used for caches, logs, idempotency, global mode)
 *
 * - No console.log is used except console.error for errors.
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient, SupabaseClient, User } from "npm:@supabase/supabase-js@2";

// CORS
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

// Types
interface RequestBody {
  dryRun?: boolean;
}

interface AgentProfile {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface Contact {
  email: string | null;
  zip_code: string | null;
}

interface Transaction {
  // Shape is flexible; we compute metrics defensively
  sold_price?: number | null;
  list_price?: number | null;
  dom?: number | null;
  price_per_sqft?: number | null;
  // Additional fields may exist
}

interface Metrics {
  median_sale_price: number | null;
  median_list_price: number | null;
  homes_sold: number;
  new_listings: number;
  median_dom: number | null;
  avg_price_per_sqft: number | null;
  inventory: number | null;
}

interface CacheData {
  zip_code: string;
  period_month: string; // YYYY-MM-01
  metrics: Metrics;
  prev_comparison?: {
    median_sale_price_delta?: number | null;
    median_list_price_delta?: number | null;
    homes_sold_delta?: number | null;
    new_listings_delta?: number | null;
    median_dom_delta?: number | null;
    avg_price_per_sqft_delta?: number | null;
    inventory_delta?: number | null;
  };
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

type Json = Record<string, unknown> | unknown[] | string | number | boolean | null;

// Helpers
function toMonthStart(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}
function toPrevMonthStart(currentStart: string): string {
  // currentStart is YYYY-MM-01
  const d = new Date(currentStart);
  if (isNaN(d.getTime())) {
    const parts = currentStart.split("-");
    const y = Number(parts[0]) || new Date().getUTCFullYear();
    const m = Number(parts[1]) || (new Date().getUTCMonth() + 1);
    const date = new Date(Date.UTC(y, m - 1, 1));
    date.setUTCMonth(date.getUTCMonth() - 1);
    return toMonthStart(date);
  }
  d.setUTCMonth(d.getUTCMonth() - 1);
  return toMonthStart(d);
}
function monthLabel(periodMonth: string) {
  const d = new Date(periodMonth);
  if (isNaN(d.getTime())) return periodMonth.slice(0, 7);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long" });
}
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
function median(nums: number[]): number | null {
  const n = nums.filter((v) => typeof v === "number" && !isNaN(v)).sort((a, b) => a - b);
  if (!n.length) return null;
  const mid = Math.floor(n.length / 2);
  return n.length % 2 === 0 ? (n[mid - 1] + n[mid]) / 2 : n[mid];
}
function average(nums: number[]): number | null {
  const n = nums.filter((v) => typeof v === "number" && !isNaN(v));
  if (!n.length) return null;
  return n.reduce((a, b) => a + b, 0) / n.length;
}
function safeNumber(n: unknown): number | null {
  const v = typeof n === "number" ? n : Number(n);
  return isFinite(v) && !isNaN(v) ? v : null;
}
function fmtUSD(n?: number | null): string {
  if (typeof n !== "number" || isNaN(n)) return "—";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
function fmtInt(n?: number | null): string {
  if (typeof n !== "number" || isNaN(n)) return "—";
  return n.toLocaleString();
}
async function hmacHexSHA256(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  const bytes = new Uint8Array(sigBuf);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Core computations
function computeMetrics(txs: Transaction[]): Metrics {
  const salePrices: number[] = [];
  const listPrices: number[] = [];
  const doms: number[] = [];
  const ppsqfts: number[] = [];

  for (const t of txs) {
    const sp = safeNumber(t.sold_price);
    const lp = safeNumber(t.list_price);
    const dom = safeNumber(t.dom);
    const ppsf = safeNumber(t.price_per_sqft);

    if (sp != null) salePrices.push(sp);
    if (lp != null) listPrices.push(lp);
    if (dom != null) doms.push(dom);
    if (ppsf != null) ppsqfts.push(ppsf);
  }

  const metrics: Metrics = {
    median_sale_price: median(salePrices),
    median_list_price: median(listPrices),
    homes_sold: salePrices.length,
    new_listings: listPrices.length,
    median_dom: median(doms),
    avg_price_per_sqft: average(ppsqfts),
    inventory: null, // unknown without active listings snapshot; keep null
  };
  return metrics;
}

function compareMetrics(curr: Metrics, prev?: Metrics | null) {
  if (!prev) return undefined;
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

function buildEmailHTML(zip: string, periodMonth: string, metrics: Metrics, agent?: AgentProfile | null, unsubscribeURL?: string) {
  const month = monthLabel(periodMonth);
  const agentName = [agent?.first_name, agent?.last_name].filter(Boolean).join(" ").trim() || "Your Agent";
  const agentEmail = agent?.email || "";
  const unsubscribeLine = unsubscribeURL
    ? `<p style="margin:16px 0 0 0; font-size:12px; color:#64748b;">To stop receiving these updates, <a href="${unsubscribeURL}">unsubscribe here</a>.</p>`
    : "";

  return `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${zip} Monthly Real Estate Newsletter — ${month}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body style="font-family:ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji; color:#0f172a; background:#ffffff; padding:24px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
      <tr>
        <td style="background:hsl(222 47% 11%); color:white; padding:24px;">
          <h1 style="margin:0;font-size:20px;">${zip} Monthly Real Estate Newsletter</h1>
          <p style="margin:8px 0 0 0;opacity:.9;">${month}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:24px;">
          <p style="margin:0 0 12px 0;">Hi there,</p>
          <p style="margin:0 0 16px 0;">Here’s your quick snapshot of the local market for <strong>${zip}</strong>.</p>

          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-top:8px;">
            <tr>
              <td style="padding:12px;border-bottom:1px solid #e5e7eb;">Median Sale Price</td>
              <td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">${fmtUSD(metrics.median_sale_price)}</td>
            </tr>
            <tr>
              <td style="padding:12px;border-bottom:1px solid #e5e7eb;">Median List Price</td>
              <td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">${fmtUSD(metrics.median_list_price)}</td>
            </tr>
            <tr>
              <td style="padding:12px;border-bottom:1px solid #e5e7eb;">Homes Sold</td>
              <td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">${fmtInt(metrics.homes_sold)}</td>
            </tr>
            <tr>
              <td style="padding:12px;border-bottom:1px solid #e5e7eb;">New Listings</td>
              <td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">${fmtInt(metrics.new_listings)}</td>
            </tr>
            <tr>
              <td style="padding:12px;border-bottom:1px solid #e5e7eb;">Median Days on Market</td>
              <td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">${fmtInt(metrics.median_dom)}</td>
            </tr>
            <tr>
              <td style="padding:12px;">Avg. Price per Sq Ft</td>
              <td style="padding:12px;text-align:right;font-weight:600;">${fmtUSD(metrics.avg_price_per_sqft)}</td>
            </tr>
          </table>

          <p style="margin:24px 0 0 0; font-size:14px; color:#475569;">
            Questions about this market update? Reply directly to this email to reach ${agentName}${agentEmail ? ` at ${agentEmail}` : ""}.
          </p>
          ${unsubscribeLine}
        </td>
      </tr>
      <tr>
        <td style="padding:16px 24px; background:#f8fafc; font-size:12px; color:#64748b;">
          You’re receiving this because you’re in our database for ${zip}. Our business address is ${Deno.env.get("COMPANY_PHYSICAL_ADDRESS") || "our office"}.
        </td>
      </tr>
    </table>
  </body>
</html>
`.trim();
}

// Data sources
async function fetchTransactionsViaFunction(supabase: SupabaseClient, zip: string, currentMonth: string): Promise<Transaction[] | null> {
  // Call existing edge function 'fetch-zip-transactions' with correct parameters
  try {
    const actorId = Deno.env.get('APIFY_ACTOR_ID');
    if (!actorId) {
      console.error("fetchTransactionsViaFunction: APIFY_ACTOR_ID not configured", { zip });
      return null;
    }

    console.log(`fetchTransactionsViaFunction: Calling fetch-zip-transactions for zip ${zip} with actor ${actorId}`);
    
    const { data, error } = await supabase.functions.invoke("fetch-zip-transactions", {
      body: { 
        zip_code: zip, 
        limit: 10,
        apify: { 
          actorId: actorId 
        }
      },
    });
    
    if (error) {
      console.error("fetchTransactionsViaFunction: Edge function error", { zip, error });
      return null; // signal fallback
    }
    
    // Expect data to have { transactions: Transaction[] } or an array directly
    const txs = Array.isArray(data) ? data : (data?.transactions ?? []);
    if (!Array.isArray(txs)) {
      console.error("fetchTransactionsViaFunction: Invalid data format", { zip, data });
      return null;
    }
    
    console.log(`fetchTransactionsViaFunction: Retrieved ${txs.length} transactions for zip ${zip}`);
    return txs as Transaction[];
  } catch (e) {
    console.error("fetchTransactionsViaFunction: Exception occurred", { zip, error: String(e) });
    return null; // signal fallback
  }
}

async function fetchTransactionsViaApifyFallback(zip: string, currentMonth: string) {
  // Fallback: attempt to run user-provided actor/task via env vars
  // Tries APIFY_TASK_ID first, then APIFY_ACTOR_ID
  const token = Deno.env.get("APIFY_API_TOKEN");
  if (!token) {
    console.error("APIFY_API_TOKEN not set; cannot use Apify fallback", { zip });
    return [] as Transaction[];
  }

  try {
    const taskId = Deno.env.get("APIFY_TASK_ID");
    const actorId = Deno.env.get("APIFY_ACTOR_ID");
    const input = {
      zip_code: zip,
      month: currentMonth.slice(0, 7),
    };

    if (taskId) {
      const url = `https://api.apify.com/v2/actor-tasks/${taskId}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!resp.ok) {
        console.error("Apify task fallback HTTP error", { zip, status: resp.status, statusText: resp.statusText });
        return [];
      }
      const json = await resp.json();
      return Array.isArray(json) ? (json as Transaction[]) : [];
    }

    if (actorId) {
      const url = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!resp.ok) {
        console.error("Apify actor fallback HTTP error", { zip, status: resp.status, statusText: resp.statusText });
        return [];
      }
      const json = await resp.json();
      return Array.isArray(json) ? (json as Transaction[]) : [];
    }

    console.error("No APIFY_TASK_ID or APIFY_ACTOR_ID configured; cannot run Apify fallback", { zip });
    return [];
  } catch (e) {
    console.error("Apify fallback failed", { zip, error: String(e) });
    return [];
  }
}

// Database ops
async function getAgentProfiles(admin: SupabaseClient): Promise<AgentProfile[]> {
  const { data, error } = await admin
    .from("profiles")
    .select("user_id, first_name, last_name, email");
  if (error) throw error;
  return (data || []) as AgentProfile[];
}

async function getAgentProfile(admin: SupabaseClient, agentId: string): Promise<AgentProfile | null> {
  const { data, error } = await admin
    .from("profiles")
    .select("user_id, first_name, last_name, email")
    .eq("user_id", agentId)
    .maybeSingle();
  if (error) throw error;
  return (data as AgentProfile) ?? null;
}

async function getAgentZipsForUser(client: SupabaseClient, agentId: string): Promise<string[]> {
  // User mode: client respects RLS; Global mode: admin client bypasses RLS
  const { data, error } = await client
    .from("contacts")
    .select("zip_code, email")
    .eq("agent_id", agentId)
    .is("dnc", false)
    .not("email", "is", null);

  if (error) throw error;
  const zips = new Set<string>();
  for (const row of (data || []) as Contact[]) {
    const z = (row.zip_code || "").trim();
    if (/^\d{5}$/.test(z)) zips.add(z);
  }
  return Array.from(zips);
}

async function getContactsForZip(client: SupabaseClient, agentId: string, zip: string): Promise<string[]> {
  const { data, error } = await client
    .from("contacts")
    .select("email")
    .eq("agent_id", agentId)
    .eq("zip_code", zip)
    .is("dnc", false)
    .not("email", "is", null);
  if (error) throw error;
  const emails = (data || []).map((r: { email: string | null }) => (r.email || "").trim()).filter(Boolean);
  // Deduplicate
  return Array.from(new Set(emails));
}

async function getCache(admin: SupabaseClient, zip: string, periodMonth: string): Promise<CacheData | null> {
  const { data, error } = await admin
    .from("zip_reports")
    .select("data")
    .eq("zip_code", zip)
    .eq("report_month", periodMonth)
    .maybeSingle();

  if (error) throw error;
  const d = data?.data as Json | undefined;
  if (!d || typeof d !== "object" || d === null) return null;
  return d as CacheData;
}

async function upsertCache(admin: SupabaseClient, zip: string, periodMonth: string, cache: CacheData) {
  const { error } = await admin
    .from("zip_reports")
    .upsert(
      {
        zip_code: zip,
        report_month: periodMonth,
        data: cache as unknown as Json,
      },
      { onConflict: "zip_code,report_month" },
    );
  if (error) throw error;
}

async function logError(admin: SupabaseClient, message: string, context?: Record<string, unknown>, agentId?: string) {
  // Fire-and-forget with protective try/catch
  try {
    await admin.from("logs").insert({
      level: "error",
      source: "newsletter-monthly",
      message,
      context: context ? (context as Json) : null,
      agent_id: agentId ?? null,
    });
  } catch (e) {
    console.error("Failed to insert into logs", { message, insertError: String(e) });
  }
}

async function checkIdempotency(admin: SupabaseClient, reportMonth: string): Promise<"skip" | "proceed"> {
  try {
    const { data, error } = await admin
      .from("monthly_runs")
      .select("id, last_run")
      .eq("run_type", "newsletter")
      .eq("report_month", reportMonth)
      .maybeSingle();

    if (error) throw error;
    if (data?.last_run) {
      const last = new Date(data.last_run);
      const now = new Date();
      const diffMs = now.getTime() - last.getTime();
      if (diffMs < 24 * 60 * 60 * 1000) return "skip";
    }
    return "proceed";
  } catch (e) {
    console.error("Idempotency check failed", { error: String(e) });
    return "proceed"; // don't block run on error
  }
}

async function markRun(admin: SupabaseClient, reportMonth: string, status: "success" | "skipped" | "error", details?: Record<string, unknown>) {
  try {
    // Upsert unique (run_type, report_month)
    const { error } = await admin
      .from("monthly_runs")
      .upsert(
        {
          run_type: "newsletter",
          report_month: reportMonth,
          last_run: new Date().toISOString(),
          status,
          details: details ? (details as Json) : null,
        },
        { onConflict: "run_type,report_month" },
      );
    if (error) throw error;
  } catch (e) {
    console.error("Failed to upsert monthly_runs", { error: String(e) });
  }
}

async function createAgentRun(admin: SupabaseClient, agentId: string, reportMonth: string, stats: Pick<Stats, "zipsProcessed" | "emailsSent" | "errors">, dryRun: boolean, status: "success" | "error" | "pending"): Promise<void> {
  try {
    const runDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    const { error } = await admin
      .from("monthly_runs")
      .upsert(
        {
          agent_id: agentId,
          run_date: runDate,
          status,
          zip_codes_processed: stats.zipsProcessed,
          emails_sent: stats.emailsSent,
          dry_run: dryRun,
          started_at: new Date().toISOString(),
          finished_at: status !== "pending" ? new Date().toISOString() : null,
          error: stats.errors.length > 0 ? stats.errors.join("; ") : null,
        },
        { onConflict: "agent_id,run_date" },
      );
    
    if (error) {
      console.error("Failed to create/update agent run record", { agentId, error });
      throw error;
    }
    
    console.log(`Created/updated monthly_runs record for agent ${agentId}`, { 
      status, 
      zipsProcessed: stats.zipsProcessed, 
      emailsSent: stats.emailsSent,
      dryRun 
    });
  } catch (e) {
    console.error("Failed to create agent run record", { agentId, error: String(e) });
    throw e;
  }
}

// Email via SendGrid
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
        // Data fetch
        let transactions = await fetchTransactionsViaFunction(admin, zip, reportMonth);
        if (transactions === null) {
          // fallback
          transactions = await fetchTransactionsViaApifyFallback(zip, reportMonth);
        }
        // Throttle Apify/remote calls
        await sleep(1000);

        if (!transactions || transactions.length === 0) {
          // Skip zips with no transactions
          continue;
        }

        // Compute metrics and historical compare
        const metrics = computeMetrics(transactions);
        let prevMetrics: Metrics | null = null;
        try {
          const prevCache = await getCache(admin, zip, prevMonth);
          prevMetrics = prevCache?.metrics ?? null;
        } catch (e) {
          // not critical
          await logError(admin, "Failed to get previous month cache for comparison", { zip, prevMonth, error: String(e) }, agentId);
        }

        const comparison = compareMetrics(metrics, prevMetrics);

        // Build HTML with agent personalization and unsubscribe link
        const unsubscribeURL = await buildUnsubscribeURL(zip, agentId);
        const html = buildEmailHTML(zip, reportMonth, metrics, agentProfile, unsubscribeURL);

        cache = {
          zip_code: zip,
          period_month: reportMonth,
          metrics,
          prev_comparison: comparison,
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
