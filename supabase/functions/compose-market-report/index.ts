import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Mode = "preview" | "send";

interface ComposeMarketReportRequest {
  zip_code: string;
  limit?: number; // default 10
  actorId?: string; // default maxcopell~zillow-zip-search
  maxWaitMs?: number; // default 45000
  advancedInput?: Record<string, unknown>;
  mode?: Mode; // preview | send
  to?: string | string[]; // required for mode=send
  subject?: string; // optional custom subject
}

interface TransactionItem {
  address?: string;
  soldPrice?: number | null;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
  soldDate?: string | null;
  url?: string | null;
}

function normalizeActorSlug(slug: string) {
  // Allow both formats: user/actor and user~actor
  return slug.includes("~") ? slug : slug.replace("/", "~");
}

function num(x: unknown): number | null {
  if (x == null) return null;
  const n = Number(String(x).toString().replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const arr = [...values].sort((a, b) => a - b);
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 === 0 ? (arr[mid - 1] + arr[mid]) / 2 : arr[mid];
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function mapTransaction(item: any): TransactionItem {
  const priceCandidates = [
    item.soldPrice,
    item.price,
    item.sold_price,
    item.sold_price_amount,
  ];
  const soldPrice = priceCandidates.map(num).find((v) => v != null) ?? null;

  const sqftCandidates = [item.sqft, item.livingArea, item.lotArea];
  const sqft = sqftCandidates.map(num).find((v) => v != null) ?? null;

  const soldDateRaw = item.soldDate || item.dateSold || item.sold_date || item.date;
  const soldDate = soldDateRaw ? new Date(soldDateRaw).toISOString() : null;

  return {
    address: item.address || item.fullAddress || item.streetAddress || null,
    soldPrice,
    beds: num(item.bedrooms) ?? num(item.beds),
    baths: num(item.bathrooms) ?? num(item.baths),
    sqft,
    soldDate,
    url: item.url || item.detailUrl || null,
  };
}

async function runApifyAndGetItems(args: {
  actorId: string;
  zip: string;
  maxWaitMs: number;
  inputOverride?: Record<string, unknown>;
  limit: number;
}) {
  const token = Deno.env.get("APIFY_API_TOKEN");
  if (!token) throw new Error("Missing APIFY_API_TOKEN secret");

  const slug = normalizeActorSlug(args.actorId);
  const startUrl = `https://api.apify.com/v2/acts/${slug}/runs?token=${encodeURIComponent(token)}`;

  const baseInput = {
    forRent: false,
    forSaleByAgent: false,
    forSaleByOwner: false,
    sold: true,
    zipCodes: [args.zip],
  } as Record<string, unknown>;

  const input = { ...baseInput, ...(args.inputOverride || {}) };

  const startRes = await fetch(startUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input }) as string,
  });

  if (!startRes.ok) {
    const text = await startRes.text();
    throw new Error(`Failed to start Apify actor: ${startRes.status} ${text}`);
  }

  const startData = await startRes.json();
  const runId = startData?.data?.id ?? startData?.data?.id ?? startData?.data?.id;
  if (!runId) throw new Error(`Apify actor did not return run ID: ${JSON.stringify(startData)}`);

  const startedAt = Date.now();
  let datasetId: string | null = null;

  while (Date.now() - startedAt < args.maxWaitMs) {
    const runRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${encodeURIComponent(token)}`);
    if (!runRes.ok) {
      const t = await runRes.text();
      throw new Error(`Failed to fetch Apify run: ${t}`);
    }
    const runData = await runRes.json();
    const status = runData?.data?.status as string;
    datasetId = runData?.data?.defaultDatasetId ?? datasetId;

    if (status === "SUCCEEDED" || status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
      break;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }

  if (!datasetId) throw new Error("Apify run finished without datasetId");

  // Fetch dataset items
  const itemsRes = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${encodeURIComponent(token)}&clean=true` +
      `&format=json&limit=${args.limit}`
  );
  if (!itemsRes.ok) {
    const t = await itemsRes.text();
    throw new Error(`Failed to fetch Apify dataset items: ${t}`);
  }
  const rawItems: any[] = await itemsRes.json();

  // Map and sort
  const txs = rawItems.map(mapTransaction).filter((x) => x.soldPrice != null);
  txs.sort((a, b) => {
    const ta = a.soldDate ? Date.parse(a.soldDate) : 0;
    const tb = b.soldDate ? Date.parse(b.soldDate) : 0;
    return tb - ta;
  });

  return txs.slice(0, args.limit);
}

function computeMetrics(txs: TransactionItem[]) {
  const prices = txs.map((t) => t.soldPrice!).filter((n): n is number => typeof n === "number");
  const sqfts = txs.map((t) => t.sqft!).filter((n): n is number => typeof n === "number");

  const medianPrice = median(prices);
  const avgPrice = average(prices);
  const minPrice = prices.length ? Math.min(...prices) : null;
  const maxPrice = prices.length ? Math.max(...prices) : null;
  const avgPPSF = prices.length && sqfts.length
    ? average(txs.filter((t) => t.soldPrice && t.sqft).map((t) => (t.soldPrice! / t.sqft!)))
    : null;

  // Simple momentum: compare median of first half vs second half (sorted desc by date)
  const half = Math.floor(prices.length / 2) || prices.length;
  const firstHalf = prices.slice(0, half);
  const secondHalf = prices.slice(half);
  const m1 = median(firstHalf);
  const m2 = median(secondHalf);
  const changeAbs = m1 != null && m2 != null ? m1 - m2 : null;
  const changePct = m1 != null && m2 != null && m2 !== 0 ? (m1 - m2) / m2 : null;

  return { medianPrice, avgPrice, minPrice, maxPrice, avgPPSF, changeAbs, changePct };
}

function currency(n: number | null, digits = 0) {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: digits }).format(n);
}

function percent(n: number | null, digits = 1) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

async function generateEmailHTML(zip: string, txs: TransactionItem[], metrics: ReturnType<typeof computeMetrics>) {
  const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openAIApiKey) throw new Error("Missing OPENAI_API_KEY secret");

  const statsForPrompt = {
    zip,
    count: txs.length,
    metrics: {
      medianPrice: metrics.medianPrice,
      avgPrice: metrics.avgPrice,
      minPrice: metrics.minPrice,
      maxPrice: metrics.maxPrice,
      avgPPSF: metrics.avgPPSF,
      changeAbs: metrics.changeAbs,
      changePct: metrics.changePct,
    },
  };

  const system = `You are a real estate analyst. Write concise, factual email content using ONLY the provided metrics. Do not invent numbers.`;
  const user = `Create an HTML email for homeowners in ZIP ${zip} summarizing the last ${txs.length} sales. Include:
- Headline with ZIP
- Bulleted key stats with Median price, Average price, Min/Max, Avg $/sqft
- One line about price change (up/down) based solely on provided change metrics
- Short closing and CTA to contact the agent

Metrics (JSON):\n${JSON.stringify(statsForPrompt)}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openAIApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI error: ${t}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content || "";

  // Ensure a minimal frame and add a small transaction table for transparency
  const rows = txs
    .map((t) => `<tr>
      <td style="padding:6px;border-bottom:1px solid #eee;">${t.address ?? "—"}</td>
      <td style="padding:6px;border-bottom:1px solid #eee;">${currency(t.soldPrice ?? null)}</td>
      <td style="padding:6px;border-bottom:1px solid #eee;">${t.soldDate ? new Date(t.soldDate).toLocaleDateString() : "—"}</td>
    </tr>`)
    .join("");

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${zip} Market Report</title>
  </head>
  <body style="font-family: Arial, sans-serif; color:#111;">
    ${content}
    <hr style="margin:20px 0;border:none;border-top:1px solid #ddd;" />
    <p style="font-size:12px;color:#666;margin:0 0 8px;">Based on the latest ${txs.length} closed transactions in ${zip}.</p>
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead>
        <tr>
          <th align="left" style="padding:6px;border-bottom:2px solid #000;">Address</th>
          <th align="left" style="padding:6px;border-bottom:2px solid #000;">Sold price</th>
          <th align="left" style="padding:6px;border-bottom:2px solid #000;">Sold date</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </body>
</html>`;

  return html;
}

async function sendWithSendGrid(to: string[], subject: string, html: string) {
  const key = Deno.env.get("SENDGRID_API_KEY");
  const fromEmail = Deno.env.get("SENDGRID_FROM_EMAIL");
  const fromName = Deno.env.get("SENDGRID_FROM_NAME") || "Market Reports";
  if (!key || !fromEmail) throw new Error("Missing SendGrid secrets");

  const body = {
    personalizations: [
      {
        to: to.map((e) => ({ email: e })),
      },
    ],
    from: { email: fromEmail, name: fromName },
    subject,
    content: [{ type: "text/html", value: html }],
    categories: ["market-report"],
  };

  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (res.status !== 202) {
    const t = await res.text();
    throw new Error(`SendGrid failed: ${res.status} ${t}`);
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    const body = (await req.json()) as ComposeMarketReportRequest;
    const zip = (body.zip_code || "").trim();
    const limit = body.limit && body.limit > 0 ? Math.min(body.limit, 25) : 10;
    const actorId = body.actorId?.trim() || "maxcopell~zillow-zip-search";
    const maxWaitMs = typeof body.maxWaitMs === "number" && body.maxWaitMs > 0 ? body.maxWaitMs : 45000;
    const mode: Mode = body.mode === "send" ? "send" : "preview";

    if (!/^\d{5}$/.test(zip)) {
      return new Response(JSON.stringify({ error: "Invalid zip_code; must be 5 digits" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Fetch transactions from Apify
    const txs = await runApifyAndGetItems({
      actorId,
      zip,
      maxWaitMs,
      inputOverride: body.advancedInput,
      limit,
    });

    if (!txs.length) {
      return new Response(JSON.stringify({ error: "No transactions returned from Apify" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Compute metrics
    const metrics = computeMetrics(txs);

    // 3) Generate AI-written HTML
    const html = await generateEmailHTML(zip, txs, metrics);

    // 4) Optionally send
    let sent = false;
    if (mode === "send") {
      const recipients: string[] = Array.isArray(body.to)
        ? body.to
        : typeof body.to === "string"
        ? body.to
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

      if (!recipients.length) {
        return new Response(JSON.stringify({ error: "Missing 'to' recipients for send mode" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const subject = body.subject || `${zip} Market Report – ${new Date().toLocaleDateString()}`;
      await sendWithSendGrid(recipients, subject, html);
      sent = true;
    }

    return new Response(
      JSON.stringify({
        zip,
        count: txs.length,
        metrics: {
          medianPrice: metrics.medianPrice,
          avgPrice: metrics.avgPrice,
          minPrice: metrics.minPrice,
          maxPrice: metrics.maxPrice,
          avgPPSF: metrics.avgPPSF,
          changeAbs: metrics.changeAbs,
          changePct: metrics.changePct,
          formatted: {
            medianPrice: currency(metrics.medianPrice),
            avgPrice: currency(metrics.avgPrice),
            minPrice: currency(metrics.minPrice),
            maxPrice: currency(metrics.maxPrice),
            avgPPSF: metrics.avgPPSF != null ? `$${metrics.avgPPSF.toFixed(0)}/sqft` : "—",
            changeAbs: currency(metrics.changeAbs),
            changePct: percent(metrics.changePct),
          },
        },
        html,
        sent,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[compose-market-report] Error:", err?.message || err);
    return new Response(JSON.stringify({ error: err?.message || "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
