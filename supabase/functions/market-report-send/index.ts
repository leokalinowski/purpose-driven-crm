import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Mode = "sample" | "apify";

interface RequestBody {
  period_month: string; // YYYY-MM
  apify?: { actorId?: string; input?: Record<string, unknown>; maxWaitMs?: number };
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

function buildTransactionsHTML(
  zip: string,
  monthKey: string,
  transactions: Array<{ address?: string; soldPrice?: number; beds?: number; baths?: number; sqft?: number; soldDate?: string; url?: string }>
): string {
  const label = monthLabel(monthKey);
  const rows = (transactions || [])
    .map((t) => {
      const addr = t.address ? String(t.address) : "—";
      const price = t.soldPrice != null ? fmtUSD(Number(t.soldPrice)) : "—";
      const bb = [t.beds != null ? `${t.beds} bd` : null, t.baths != null ? `${t.baths} ba` : null, t.sqft != null ? `${fmtInt(Number(t.sqft))} sqft` : null]
        .filter(Boolean)
        .join(" · ") || "—";
      const date = t.soldDate ? new Date(t.soldDate).toLocaleDateString() : "—";
      const link = t.url ? `<a href="${t.url}" target="_blank" rel="noopener" style="color:#2563eb; text-decoration:underline;">View</a>` : "—";
      return `<tr>
        <td style=\"padding:8px;border-bottom:1px solid #e2e8f0;\">${addr}</td>
        <td style=\"padding:8px;border-bottom:1px solid #e2e8f0; text-align:right; font-weight:600;\">${price}</td>
        <td style=\"padding:8px;border-bottom:1px solid #e2e8f0;\">${bb}</td>
        <td style=\"padding:8px;border-bottom:1px solid #e2e8f0;\">${date}</td>
        <td style=\"padding:8px;border-bottom:1px solid #e2e8f0; text-align:center;\">${link}</td>
      </tr>`;
    })
    .join("");

  return `
  <div style="font-family: Inter, Arial, sans-serif; line-height: 1.6; color: #0f172a;">
    <h1 style="margin: 0 0 8px; font-size: 20px;">${zip} Recent Sales — ${label}</h1>
    <p style="margin: 0 0 16px; color: #475569;">Latest ${transactions.length} closed transactions in ${zip}.</p>
    <table style="width:100%; border-collapse: collapse;">
      <thead>
        <tr>
          <th style="text-align:left; padding:8px; border-bottom:2px solid #94a3b8;">Address</th>
          <th style="text-align:right; padding:8px; border-bottom:2px solid #94a3b8;">Sold price</th>
          <th style="text-align:left; padding:8px; border-bottom:2px solid #94a3b8;">Details</th>
          <th style="text-align:left; padding:8px; border-bottom:2px solid #94a3b8;">Sold date</th>
          <th style="text-align:center; padding:8px; border-bottom:2px solid #94a3b8;">Link</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="margin-top:16px; color:#64748b; font-size:12px;">Data sourced in real-time from your configured Apify actor.</p>
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
    const { period_month, apify, zip_filter = [] } = (await req.json()) as RequestBody;

    if (!period_month) {
      return new Response(JSON.stringify({ error: "period_month (YYYY-MM) is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!apify?.actorId) {
      return new Response(JSON.stringify({ error: "apify.actorId is required" }), {
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

    // Cache transactions per ZIP to avoid repeated calls
    const txCache = new Map<string, any[]>();

    async function getTransactionsFor(zip: string) {
      if (txCache.has(zip)) return txCache.get(zip)!;
      const payload: any = { zip_code: zip, limit: 10, apify: { actorId: apify!.actorId!, input: apify?.input, maxWaitMs: apify?.maxWaitMs } };
      const { data: txResp, error: txErr } = await supabase.functions.invoke("fetch-zip-transactions", {
        body: payload,
      });
      if (txErr) {
        console.error("[market-report-send] fetch-zip-transactions error", txErr);
        txCache.set(zip, []);
        return [] as any[];
      }
      const items: any[] = (txResp?.transactions ?? []) as any[];
      txCache.set(zip, items);
      return items;
    }

    let sent = 0;
    const errors: Array<{ email: string; reason: string }> = [];

    for (const c of recipients) {
      const zip = String(c.zip_code || zip_filter[0]);
      const tx = await getTransactionsFor(zip);
      if (!tx || tx.length === 0) {
        errors.push({ email: c.email, reason: "No transactions returned for ZIP; email skipped" });
        continue;
      }
      const subject = `${zip} Recent Sales — ${monthLabel(period_month)}`;
      const html = buildTransactionsHTML(zip, period_month, tx);

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
