import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Mode = "sample" | "apify";

interface RequestBody {
  period_month: string; // YYYY-MM
  mode?: Mode;
  apify?: { actorId?: string };
  zip_filter?: string[]; // e.g., ["90210"]
}

function monthToDate(periodMonth?: string): string {
  const now = new Date();
  if (!periodMonth) return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const [y, m] = periodMonth.split("-");
  const year = Number(y);
  const month = Number(m);
  if (!year || !month) return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
  return `${y}-${String(month).padStart(2, "0")}-01`;
}

function monthLabel(yyyymm: string): string {
  try {
    const d = new Date(`${yyyymm}-01T00:00:00Z`);
    return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  } catch {
    return yyyymm;
  }
}

function fmtUSD(n: number | null | undefined): string {
  if (n == null) return "N/A";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
  } catch {
    return `$${Math.round(n)}`;
  }
}

function fmtInt(n: number | null | undefined): string {
  if (n == null) return "N/A";
  try {
    return new Intl.NumberFormat().format(n);
  } catch {
    return String(n);
  }
}

function buildReportHTML(zip: string, monthKey: string, stats: any): string {
  const label = monthLabel(monthKey);
  return `
  <div style="font-family: Inter, Arial, sans-serif; line-height: 1.6; color: #0f172a;">
    <h1 style="margin: 0 0 8px; font-size: 20px;">${zip} Market Report — ${label}</h1>
    <p style="margin: 0 0 16px; color: #475569;">Your monthly snapshot of the real estate market.</p>
    <table style="width:100%; border-collapse: collapse;">
      <tbody>
        <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;">Median Sale Price</td><td style="padding:8px;border-bottom:1px solid #e2e8f0; font-weight:600;">${fmtUSD(Number(stats?.median_sale_price ?? null))}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;">Median List Price</td><td style="padding:8px;border-bottom:1px solid #e2e8f0; font-weight:600;">${fmtUSD(Number(stats?.median_list_price ?? null))}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;">Homes Sold</td><td style="padding:8px;border-bottom:1px solid #e2e8f0; font-weight:600;">${fmtInt(stats?.homes_sold ?? null)}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;">New Listings</td><td style="padding:8px;border-bottom:1px solid #e2e8f0; font-weight:600;">${fmtInt(stats?.new_listings ?? null)}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;">Median Days on Market</td><td style="padding:8px;border-bottom:1px solid #e2e8f0; font-weight:600;">${fmtInt(stats?.median_dom ?? null)} days</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;">Avg Price / Sqft</td><td style="padding:8px;border-bottom:1px solid #e2e8f0; font-weight:600;">${fmtUSD(Number(stats?.avg_price_per_sqft ?? null))}</td></tr>
        <tr><td style="padding:8px;">Inventory</td><td style="padding:8px; font-weight:600;">${fmtInt(stats?.inventory ?? null)} homes</td></tr>
      </tbody>
    </table>
    <p style="margin-top:16px; color:#64748b; font-size:12px;">This is an automated update. Values may be approximate.</p>
  </div>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: "Missing Supabase configuration" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    const { period_month, mode = "sample", apify, zip_filter = [] } = (await req.json()) as RequestBody;

    if (!period_month) {
      return new Response(JSON.stringify({ error: "period_month (YYYY-MM) is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!Array.isArray(zip_filter) || zip_filter.length === 0) {
      return new Response(JSON.stringify({ error: "zip_filter must include at least one ZIP code" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const periodDate = monthToDate(period_month);

    // Fetch contacts by ZIP and DNC=false and email present
    const { data: contacts, error: contactsErr } = await supabase
      .from("contacts")
      .select("id, email, first_name, last_name, zip_code, dnc")
      .in("zip_code", zip_filter)
      .eq("dnc", false)
      .not("email", "is", null);

    if (contactsErr) {
      console.error("[market-report-send] contacts error", contactsErr);
      return new Response(JSON.stringify({ error: contactsErr.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const recipients = (contacts || []).filter((c: any) => !!c.email);

    if (recipients.length === 0) {
      return new Response(JSON.stringify({ recipients: 0, sent: 0, errors: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Cache stats per ZIP to avoid repeated calls
    const statsCache = new Map<string, any>();

    async function getStatsFor(zip: string) {
      if (statsCache.has(zip)) return statsCache.get(zip);
      const payload: any = { zip_code: zip, period_month, mode };
      if (mode === "apify" && apify?.actorId) payload.apify = { actorId: apify.actorId };
      const { data: statsResp, error: statsErr } = await supabase.functions.invoke("fetch-market-stats", {
        body: payload,
      });
      if (statsErr) {
        console.error("[market-report-send] fetch-market-stats error", statsErr);
      }
      const row = statsResp?.data ?? null;
      statsCache.set(zip, row);
      return row;
    }

    let sent = 0;
    const errors: Array<{ email: string; reason: string }> = [];

    for (const c of recipients) {
      const zip = String(c.zip_code || zip_filter[0]);
      const stats = await getStatsFor(zip);
      const subject = `${zip} Market Report — ${monthLabel(period_month)}`;
      const html = buildReportHTML(zip, period_month, stats);

      try {
        const { error: sendErr } = await supabase.functions.invoke("send-email", {
          body: { to: c.email, subject, html },
        });
        if (sendErr) {
          console.error("[market-report-send] send-email error", sendErr);
          errors.push({ email: c.email, reason: sendErr.message || "send-email failed" });
        } else {
          sent += 1;
        }
      } catch (e: any) {
        console.error("[market-report-send] send-email exception", e);
        errors.push({ email: c.email, reason: e?.message || "exception" });
      }
    }

    const result = { recipients: recipients.length, sent, errors };
    console.log("[market-report-send] result", result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err: any) {
    console.error("[market-report-send] Unexpected error", err);
    return new Response(JSON.stringify({ error: err?.message || "Unexpected error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
