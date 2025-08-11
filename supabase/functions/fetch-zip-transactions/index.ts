import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  zip_code: string;
  limit?: number; // default 10
  apify: {
    actorId: string; // e.g. "maxcopell/zillow-zip-search" (slash ok)
    input?: Record<string, unknown>;
    maxWaitMs?: number; // default 15000
  };
}

function normalizeActorSlug(slug: string) {
  // Apify API expects user~actor format
  if (slug.includes("~")) return slug;
  const parts = slug.split("/").filter(Boolean);
  if (parts.length >= 2) return `${parts[0]}~${parts.slice(1).join("-")}`;
  return slug.replaceAll("/", "~");
}

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

function toNumber(x: any): number | undefined {
  const n = typeof x === "number" ? x : Number(x);
  return isFinite(n) ? n : undefined;
}

function mapTransaction(item: any) {
  const address = item?.address?.full || item?.address?.line || item?.address || item?.streetAddress || item?.location?.address || undefined;
  const soldPrice = toNumber(item?.soldPrice ?? item?.price?.amount ?? item?.price?.value ?? item?.price ?? item?.sold_price);
  const beds = toNumber(item?.beds ?? item?.bedrooms);
  const baths = toNumber(item?.baths ?? item?.bathrooms);
  const sqft = toNumber(item?.sqft ?? item?.livingArea ?? item?.area);
  const soldDate = item?.soldDate || item?.dateSold || item?.closedDate || item?.saleDate || undefined;
  const url = item?.url || item?.propertyUrl || (item?.zpid ? `https://www.zillow.com/homedetails/${item.zpid}_zpid/` : undefined);
  return { address, soldPrice, beds, baths, sqft, soldDate, url };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as RequestBody;
    const { zip_code, limit = 10, apify } = body;

    if (!zip_code || !/^[0-9]{5}$/.test(String(zip_code))) {
      return new Response(JSON.stringify({ error: "Valid zip_code (5 digits) is required" }), {
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

    const token = Deno.env.get("APIFY_API_TOKEN");
    if (!token) {
      return new Response(JSON.stringify({ error: "APIFY_API_TOKEN not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const slug = normalizeActorSlug(apify.actorId);
    const maxWaitMs = Math.max(0, apify?.maxWaitMs ?? 15000);

    // Prepare actor input: pass through provided input, but ensure required fields for this actor
    const input: Record<string, unknown> = {
      ...(apify?.input || {}),
    };
    // Actor expects `zipCodes` array and supports `sold` flag for recently sold
    if (!("zipCodes" in input)) {
      input.zipCodes = [String(zip_code)];
    }
    if (!("sold" in input)) {
      input.sold = true;
    }

    console.log("[fetch-zip-transactions] Starting Apify actor run", { slug, input });

    const runRes = await fetch(`https://api.apify.com/v2/acts/${encodeURIComponent(slug)}/runs?token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    const runJson: any = await runRes.json().catch(() => ({}));
    if (!runRes.ok) {
      console.error("[fetch-zip-transactions] Actor run start failed", runJson);
      return new Response(JSON.stringify({ error: runJson?.error?.message || runJson?.message || "Actor start failed" }), {
        status: 502,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const runId = runJson?.data?.id || runJson?.id;
    if (!runId) {
      console.error("[fetch-zip-transactions] Missing runId", runJson);
      return new Response(JSON.stringify({ error: "Failed to start actor run (no run id)" }), {
        status: 502,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log("[fetch-zip-transactions] Actor run started", { runId });

    const started = Date.now();
    let datasetId: string | undefined;
    let items: any[] = [];

    while (Date.now() - started < maxWaitMs) {
      // Check run status
      const runStatusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${token}`);
      const runStatusJson: any = await runStatusRes.json().catch(() => ({}));
      datasetId = datasetId || runStatusJson?.data?.defaultDatasetId || runStatusJson?.defaultDatasetId;

      if (datasetId) {
        const itemsRes = await fetch(
          `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}&clean=true&limit=${encodeURIComponent(String(limit))}`
        );
        const arr = (await itemsRes.json().catch(() => [])) as any[];
        if (Array.isArray(arr) && arr.length > 0) {
          items = arr;
          break;
        }
      }

      // If run finished but still no items, break early
      const status: string | undefined = runStatusJson?.data?.status || runStatusJson?.status;
      if (status && ["SUCCEEDED", "FAILED", "ABORTED", "TIMED_OUT"].includes(status)) {
        if (status !== "SUCCEEDED") {
          console.error("[fetch-zip-transactions] Run ended without success", { status });
        }
        // Try one last time to read items
        if (datasetId) {
          const itemsRes = await fetch(
            `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}&clean=true&limit=${encodeURIComponent(String(limit))}`
          );
          const arr = (await itemsRes.json().catch(() => [])) as any[];
          if (Array.isArray(arr) && arr.length > 0) items = arr;
        }
        break;
      }

      await sleep(1500);
    }

    if (!items || items.length === 0) {
      console.error("[fetch-zip-transactions] No dataset items ready within wait window");
      return new Response(JSON.stringify({ error: "Apify run returned no items within wait window" }), {
        status: 424,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const mapped = items.map(mapTransaction).filter((t) => t.address || t.soldPrice || t.url);
    console.log("[fetch-zip-transactions] Items fetched", { count: mapped.length, runId });

    return new Response(
      JSON.stringify({ transactions: mapped.slice(0, limit) }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (err: any) {
    console.error("[fetch-zip-transactions] Unexpected error", err);
    return new Response(JSON.stringify({ error: err?.message || "Unexpected error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
