/**
 * Supabase Edge Function: market-report-monthly
 *
 * Purpose:
 * - On a schedule (5th of each month) or manual trigger, build/cache market stats
 *   for a set of zip codes into the public.zip_reports table.
 *
 * Request body (JSON):
 * {
 *   "zips": ["90210", "10001"], // optional; if not given, falls back to DEFAULT_ZIPS secret
 *   "month": "2025-07",         // optional; defaults to previous month; stored as YYYY-MM-01
 *   "force": false              // optional; if true, rebuilds even if cache exists
 * }
 *
 * Notes:
 * - Uses service role key to bypass RLS and write into zip_reports.
 * - Calls existing edge function "fetch-market-stats" to retrieve stats for each zip.
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
type Json = Record<string, unknown> | unknown[] | string | number | boolean | null;

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function toMonthStartString(input?: string): string {
  if (input && /^\d{4}-\d{2}$/.test(input)) {
    return `${input}-01`;
  }
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // 0..11
  const prevY = m === 0 ? y - 1 : y;
  const prevM = m === 0 ? 11 : m - 1;
  return `${prevY}-${String(prevM + 1).padStart(2, "0")}-01`;
}

function getZipsFromEnv(): string[] {
  const raw = Deno.env.get("DEFAULT_ZIPS") || "";
  return raw
    .split(",")
    .map((z) => z.trim())
    .filter((z) => z.length > 0);
}

function uniq(arr: string[]) {
  return Array.from(new Set(arr));
}

async function fetchMarketStats(zip: string, reportMonthStart: string) {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/fetch-market-stats`;
  // Try a flexible payload to be compatible with different parameter names
  const payload: Record<string, string> = {
    zip,
    zip_code: zip,
    month: reportMonthStart.slice(0, 7), // "YYYY-MM"
    report_month: reportMonthStart, // "YYYY-MM-01"
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await resp.text();
  let data: Json = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // keep raw text for debugging
    data = { raw: text };
  }

  if (!resp.ok) {
    console.error("fetch-market-stats failed", { zip, reportMonthStart, status: resp.status, data });
    throw new Error(`fetch-market-stats failed for ${zip}: ${resp.status}`);
  }

  console.log("fetch-market-stats ok", { zip, reportMonthStart });
  return data;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const {
      zips: zipsFromBody,
      month,
      force = false,
    }: { zips?: string[]; month?: string; force?: boolean } = body || {};

    const reportMonthStart = toMonthStartString(month);
    const zips = uniq(
      Array.isArray(zipsFromBody) ? zipsFromBody.map(String) : getZipsFromEnv()
    ).filter((z) => /^\d{5}$/.test(z));

    console.log("market-report-monthly invoked", {
      trigger: (body && body.trigger) || "manual/cron",
      reportMonthStart,
      zipsCount: zips.length,
      force,
    });

    if (zips.length === 0) {
      return new Response(
        JSON.stringify({
          status: "no-op",
          message:
            "No ZIP codes provided. Pass { zips: [...] } in the body or set DEFAULT_ZIPS secret.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const results: Array<{ zip: string; status: string; error?: string }> = [];

    for (const zip of zips) {
      try {
        // Skip if cached and not forcing
        if (!force) {
          const { data: existing, error: selErr } = await supabaseAdmin
            .from("zip_reports")
            .select("id")
            .eq("zip_code", zip)
            .eq("report_month", reportMonthStart)
            .maybeSingle();

          if (selErr) {
            console.warn("Select existing cache error", { zip, reportMonthStart, selErr });
          }

          if (existing) {
            console.log("Cache exists, skipping", { zip, reportMonthStart });
            results.push({ zip, status: "skipped" });
            continue;
          }
        }

        // Fetch fresh stats via existing function
        const stats = await fetchMarketStats(zip, reportMonthStart);

        // Upsert cache
        const { error: upsertErr } = await supabaseAdmin
          .from("zip_reports")
          .upsert(
            {
              zip_code: zip,
              report_month: reportMonthStart,
              data: stats as Json,
            },
            { onConflict: "zip_code,report_month" }
          );

        if (upsertErr) {
          console.error("Upsert error", { zip, reportMonthStart, upsertErr });
          results.push({ zip, status: "error", error: upsertErr.message });
          continue;
        }

        console.log("Cached", { zip, reportMonthStart });
        results.push({ zip, status: "cached" });
      } catch (e) {
        console.error("Processing zip failed", { zip, reportMonthStart, error: String(e) });
        results.push({ zip, status: "error", error: String(e) });
      }
    }

    return new Response(JSON.stringify({ reportMonthStart, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("market-report-monthly fatal error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
