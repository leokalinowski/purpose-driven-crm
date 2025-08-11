
/**
 * Supabase Edge Function: fetch-market-stats
 * 
 * Modes:
 * - "sample" (default): generates realistic placeholder stats deterministically from zip+month.
 * - "apify": scaffolded to use Apify later (requires actor info). If not provided, falls back to "sample".
 * 
 * Upserts one row into public.market_stats for (zip_code, period_month) and returns the saved record.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type RequestBody = {
  zip_code: string;
  period_month?: string; // 'YYYY-MM', defaults to current month
  mode?: 'sample' | 'apify';
  apify?: {
    actorId?: string;
    input?: Record<string, unknown>;
    maxWaitMs?: number;
  };
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function monthToDate(periodMonth?: string): string {
  if (!periodMonth) {
    const d = new Date();
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  }
  // Expect YYYY-MM
  const [y, m] = periodMonth.split('-');
  const yy = Number(y);
  const mm = Number(m);
  if (!yy || !mm || mm < 1 || mm > 12) {
    const d = new Date();
    const year = d.getUTCFullYear();
    const mon = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${mon}-01`;
  }
  return `${y}-${m}-01`;
}

function seededRandom(seed: string) {
  // Simple deterministic pseudo-random generator based on xorshift32
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h ^= h << 13; h >>>= 0;
    h ^= h >> 17; h >>>= 0;
    h ^= h << 5;  h >>>= 0;
    return (h >>> 0) / 4294967296;
  };
}

function generateSampleStats(zip: string, periodMonth: string) {
  const rand = seededRandom(`${zip}-${periodMonth}`);
  const medianSale = Math.round(400000 + rand() * 600000); // 400k - 1.0M
  const medianList = Math.round(medianSale * (0.95 + rand() * 0.1)); // +/- 5%
  const homesSold = Math.round(15 + rand() * 120); // 15 - 135
  const newListings = Math.round(20 + rand() * 140); // 20 - 160
  const medianDom = Math.round(10 + rand() * 50); // 10 - 60
  const avgPpsf = Math.round(200 + rand() * 600); // $200 - $800
  const inventory = Math.round(50 + rand() * 300); // 50 - 350

  return {
    median_sale_price: medianSale,
    median_list_price: medianList,
    homes_sold: homesSold,
    new_listings: newListings,
    median_dom: medianDom,
    avg_price_per_sqft: avgPpsf,
    inventory,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const body = (await req.json().catch(() => ({}))) as RequestBody;
  const zip = (body.zip_code || '').trim();
  const mode = body.mode ?? 'sample';
  const periodMonthInput = body.period_month;
  const periodDate = monthToDate(periodMonthInput);

  if (!zip || !/^\d{5}$/.test(zip)) {
    return new Response(
      JSON.stringify({ error: 'Invalid zip_code. Please provide a 5-digit US ZIP.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  console.log('[fetch-market-stats] Request', { zip, mode, periodDate, apifyProvided: !!body.apify?.actorId });

  let stats:
    | {
        median_sale_price?: number;
        median_list_price?: number;
        homes_sold?: number;
        new_listings?: number;
        median_dom?: number;
        avg_price_per_sqft?: number;
        inventory?: number;
      }
    | null = null;

  let source: Record<string, unknown> = { mode };

  if (mode === 'apify' && body.apify?.actorId) {
    try {
      const token = Deno.env.get('APIFY_API_TOKEN');
      if (!token) {
        console.warn('[fetch-market-stats] APIFY_API_TOKEN not set, falling back to sample.');
      } else {
        // Example scaffold: trigger an actor run with provided input.
        // IMPORTANT: You should tailor actorId and input mapping to your specific Apify actor.
        const actorId = body.apify.actorId;
        const input = body.apify.input ?? { zip_code: zip, month: periodDate };

        console.log('[fetch-market-stats] Starting Apify actor run', { actorId, input });
        const runResp = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input }),
        });

        const run = await runResp.json();
        console.log('[fetch-market-stats] Actor run started', run);

        // Minimal wait/poll up to maxWaitMs, else fall back to sample.
        const maxWait = body.apify.maxWaitMs ?? 4000;
        const start = Date.now();
        let datasetItems: any[] | null = null;

        if (run?.data?.defaultDatasetId) {
          const datasetId = run.data.defaultDatasetId as string;
          while (Date.now() - start < maxWait) {
            await new Promise((r) => setTimeout(r, 1000));
            const dsResp = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}`);
            if (dsResp.ok) {
              const items = await dsResp.json().catch(() => null);
              if (Array.isArray(items) && items.length > 0) {
                datasetItems = items;
                break;
              }
            }
          }
        }

        if (datasetItems && datasetItems.length > 0) {
          // TODO: Map your Apify dataset fields to our schema.
          // For now, attempt some common field names with optional chaining.
          const first = datasetItems[0] ?? {};
          stats = {
            median_sale_price: Number(first.medianSalePrice ?? first.median_sale_price ?? first.median_sale),
            median_list_price: Number(first.medianListPrice ?? first.median_list_price ?? first.median_list),
            homes_sold: Number(first.homesSold ?? first.homes_sold ?? first.sales),
            new_listings: Number(first.newListings ?? first.new_listings),
            median_dom: Number(first.medianDom ?? first.median_dom ?? first.daysOnMarket),
            avg_price_per_sqft: Number(first.avgPricePerSqft ?? first.avg_price_per_sqft ?? first.pricePerSqft),
            inventory: Number(first.inventory ?? first.activeListings ?? first.active_listings),
          };

          source = {
            mode,
            actorId: body.apify.actorId,
            runId: run?.data?.id,
            datasetId: run?.data?.defaultDatasetId,
            mapping: 'best-effort',
          };
        } else {
          console.warn('[fetch-market-stats] No dataset items ready within wait window; falling back to sample.');
        }
      }
    } catch (e) {
      console.error('[fetch-market-stats] Apify flow failed, falling back to sample.', e);
    }
  }

  if (!stats) {
    // Fallback or default: sample generation
    const yyyymm = periodDate.slice(0, 7);
    stats = generateSampleStats(zip, yyyymm);
    source = { ...source, fallback: 'sample' };
  }

  const payload = {
    zip_code: zip,
    period_month: periodDate, // YYYY-MM-01
    ...stats,
    source,
  };

  const { data, error } = await supabase
    .from('market_stats')
    .upsert(payload, { onConflict: 'zip_code,period_month' })
    .select()
    .single();

  if (error) {
    console.error('[fetch-market-stats] Upsert failed', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  console.log('[fetch-market-stats] Upserted market_stats row id:', data?.id);

  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
