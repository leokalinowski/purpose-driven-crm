/**
 * sync-realtor-market-data
 *
 * Replaces the manual CSV-upload flow with a monthly auto-fetch from
 * realtor.com's public research data feed. Realtor.com publishes a
 * ZIP-level inventory metrics CSV monthly to a public S3 bucket — no
 * scraping required, just an HTTP GET.
 *
 * Source: https://econdata.s3-us-west-2.amazonaws.com/Reports/Core/RDC_Inventory_Core_Metrics_Zip.csv
 * Cadence: monthly (typically published mid-month for the prior month)
 *
 * Mapping (realtor.com → market_stats):
 *   month_date_yyyymm        → period_month        (first day of that month)
 *   postal_code              → zip_code
 *   zip_name                 → source.area_name
 *   median_listing_price     → median_list_price
 *   median_listing_price_yy  → source.yoy_change   (decimal, e.g. 0.0848 = +8.48%)
 *   active_listing_count     → inventory
 *   median_days_on_market    → median_dom
 *   new_listing_count        → new_listings
 *   median_listing_price_per_square_foot → avg_price_per_sqft
 *
 * Upserts on (zip_code, period_month) — safe to re-run.
 *
 * Invocation
 *   POST /functions/v1/sync-realtor-market-data
 *     {}                          ← cron or admin: sync everything
 *     { dry_run: true }           ← parse + count, do not write
 *     { source_url: "https://..." } ← override the CSV URL (testing)
 *
 * Auth
 *   • cron:  X-Cron-Job: true  OR  source: pg_cron
 *   • user:  bearer token; admin only (the table's RLS already restricts writes)
 *
 * CHANGE LOG
 *   2026-04 — Realtor.com CSV occasionally has duplicate (zip_code, period_month)
 *             pairs (12 in the April 2026 file). Postgres ON CONFLICT can't
 *             update the same row twice in one statement, so we dedupe in-memory
 *             keeping the LAST occurrence per (zip, period) before upserting.
 *             Backported from live v5 to disk 2026-05-18 as part of the CORS
 *             hardening PR — the dedupe fix had drifted live-only.
 *   2026-05-18 — CORS hardened: corsHeaders → buildCorsHeaders(req).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';
import { buildCorsHeaders } from '../_shared/cors.ts';

const REALTOR_ZIP_CSV_URL =
  'https://econdata.s3-us-west-2.amazonaws.com/Reports/Core/RDC_Inventory_Core_Metrics_Zip.csv';

const BATCH_SIZE = 500;

interface RealtorRow {
  month_date_yyyymm: string;
  postal_code: string;
  zip_name: string;
  median_listing_price: number | null;
  median_listing_price_yy: number | null;
  active_listing_count: number | null;
  median_days_on_market: number | null;
  new_listing_count: number | null;
  median_listing_price_per_square_foot: number | null;
}

interface MarketStatsRow {
  zip_code: string;
  period_month: string;     // YYYY-MM-01
  median_list_price: number | null;
  inventory: number | null;
  median_dom: number | null;
  new_listings: number | null;
  avg_price_per_sqft: number | null;
  source: {
    provider: 'realtor.com';
    area_name: string;
    yoy_change: number | null;
    fetched_url: string;
  };
}

// ─── CSV parsing ─────────────────────────────────────────────────────────────

/**
 * Tiny CSV parser handling double-quoted fields with embedded commas.
 * Realtor.com files use unix line endings and quote zip_name (which contains a
 * comma between city and state). No escaped quotes in the dataset.
 */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"') inQuote = false;
      else cur += ch;
    } else {
      if (ch === ',') {
        out.push(cur);
        cur = '';
      } else if (ch === '"') {
        inQuote = true;
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out;
}

function num(v: string): number | null {
  if (v === '' || v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function periodMonthFromYyyymm(yyyymm: string): string | null {
  // realtor.com format: "202603" → "2026-03-01"
  const m = /^(\d{4})(\d{2})$/.exec(yyyymm.trim());
  if (!m) return null;
  return `${m[1]}-${m[2]}-01`;
}

function parseRealtorCsv(csvText: string): RealtorRow[] {
  // Strip BOM if present, normalize line endings.
  const cleaned = csvText.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const lines = cleaned.split('\n').filter((l) => l.length > 0);
  if (lines.length < 2) return [];

  const header = parseCsvLine(lines[0]).map((h) => h.trim());
  const idx = (name: string) => header.indexOf(name);

  const i_period = idx('month_date_yyyymm');
  const i_zip = idx('postal_code');
  const i_name = idx('zip_name');
  const i_price = idx('median_listing_price');
  const i_yoy = idx('median_listing_price_yy');
  const i_active = idx('active_listing_count');
  const i_dom = idx('median_days_on_market');
  const i_new = idx('new_listing_count');
  const i_ppsf = idx('median_listing_price_per_square_foot');

  if (i_period < 0 || i_zip < 0) {
    throw new Error(
      `Unexpected CSV schema. Expected month_date_yyyymm and postal_code columns. Got: ${header.join(', ')}`,
    );
  }

  const rows: RealtorRow[] = [];
  for (let li = 1; li < lines.length; li++) {
    const cols = parseCsvLine(lines[li]);
    if (cols.length < header.length) continue; // ragged row, skip
    const zip = cols[i_zip]?.trim();
    if (!zip || !/^\d{3,5}$/.test(zip)) continue; // realtor.com keeps leading zero in zip_name but col may be numeric
    rows.push({
      month_date_yyyymm: cols[i_period]?.trim() ?? '',
      postal_code: zip.padStart(5, '0'),
      zip_name: cols[i_name]?.trim() ?? '',
      median_listing_price: num(cols[i_price] ?? ''),
      median_listing_price_yy: num(cols[i_yoy] ?? ''),
      active_listing_count: num(cols[i_active] ?? ''),
      median_days_on_market: num(cols[i_dom] ?? ''),
      new_listing_count: num(cols[i_new] ?? ''),
      median_listing_price_per_square_foot: num(cols[i_ppsf] ?? ''),
    });
  }
  return rows;
}

function toMarketStatsRow(r: RealtorRow, sourceUrl: string): MarketStatsRow | null {
  const periodMonth = periodMonthFromYyyymm(r.month_date_yyyymm);
  if (!periodMonth) return null;
  return {
    zip_code: r.postal_code,
    period_month: periodMonth,
    median_list_price: r.median_listing_price,
    inventory: r.active_listing_count != null ? Math.round(r.active_listing_count) : null,
    median_dom: r.median_days_on_market != null ? Math.round(r.median_days_on_market) : null,
    new_listings: r.new_listing_count != null ? Math.round(r.new_listing_count) : null,
    avg_price_per_sqft: r.median_listing_price_per_square_foot,
    source: {
      provider: 'realtor.com',
      area_name: r.zip_name,
      yoy_change: r.median_listing_price_yy,
      fetched_url: sourceUrl,
    },
  };
}

/**
 * Dedupe by (zip_code, period_month) keeping the LAST occurrence in CSV order.
 * Realtor.com sometimes emits the same ZIP twice across the file; the later
 * row is treated as canonical. Required because Postgres ON CONFLICT cannot
 * update the same row twice in one statement (`ERROR: 21000 — cannot affect
 * row a second time`).
 */
function dedupe(rows: MarketStatsRow[]): { unique: MarketStatsRow[]; dropped: number } {
  const map = new Map<string, MarketStatsRow>();
  for (const r of rows) {
    const key = `${r.zip_code}|${r.period_month}`;
    map.set(key, r);
  }
  return { unique: [...map.values()], dropped: rows.length - map.size };
}

// ─── Auth helper ─────────────────────────────────────────────────────────────

async function authorize(req: Request, supabaseUrl: string, anonKey: string): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  // Cron bypass — used by pg_cron's invoke wrapper.
  if (req.headers.get('X-Cron-Job') === 'true') return { ok: true };

  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.toLowerCase().startsWith('bearer ')
    ? auth.slice(7).trim()
    : '';
  if (!token) return { ok: false, status: 401, message: 'Missing bearer token' };

  // Check role via RPC
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: role, error } = await userClient.rpc('get_current_user_role');
  if (error) return { ok: false, status: 401, message: error.message };
  if (role !== 'admin') return { ok: false, status: 403, message: 'Admin only' };
  return { ok: true };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' },
  });
}

// ─── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: buildCorsHeaders(req) });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  if (!supabaseUrl || !serviceRoleKey) {
    return json(req, { error: 'Server not configured' }, 500);
  }

  const auth = await authorize(req, supabaseUrl, anonKey);
  if (!auth.ok) return json(req, { error: auth.message }, auth.status);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Parse body (optional)
  let body: { dry_run?: boolean; source_url?: string } = {};
  if (req.method === 'POST') {
    try {
      const text = await req.text();
      if (text) body = JSON.parse(text);
    } catch {
      // ignore — empty body is fine
    }
  }

  const sourceUrl = body.source_url?.trim() || REALTOR_ZIP_CSV_URL;
  const dryRun = body.dry_run === true;

  // 1. Fetch the CSV
  const startedAt = Date.now();
  let csvText: string;
  try {
    const res = await fetch(sourceUrl, {
      headers: {
        'User-Agent': 'REOP-CRM/sync-realtor-market-data',
        Accept: 'text/csv,application/octet-stream;q=0.9,*/*;q=0.5',
      },
    });
    if (!res.ok) {
      return json(req, { error: `Realtor.com fetch failed: ${res.status} ${res.statusText}`, source_url: sourceUrl }, 502);
    }
    csvText = await res.text();
  } catch (err) {
    return json(req, { error: 'Realtor.com fetch threw', detail: err instanceof Error ? err.message : String(err) }, 502);
  }

  if (!csvText || csvText.length < 100) {
    return json(req, { error: 'CSV response was empty or too small', size_bytes: csvText?.length ?? 0 }, 502);
  }

  // 2. Parse + map
  let realtorRows: RealtorRow[];
  try {
    realtorRows = parseRealtorCsv(csvText);
  } catch (err) {
    return json(req, { error: 'CSV parse failed', detail: err instanceof Error ? err.message : String(err) }, 500);
  }

  const statsRowsRaw: MarketStatsRow[] = [];
  let skipped = 0;
  for (const r of realtorRows) {
    const mapped = toMarketStatsRow(r, sourceUrl);
    if (!mapped) {
      skipped++;
      continue;
    }
    statsRowsRaw.push(mapped);
  }

  // 3. Dedupe (zip_code, period_month) so ON CONFLICT doesn't fire twice on same row.
  const { unique: statsRows, dropped: deduped } = dedupe(statsRowsRaw);

  if (statsRows.length === 0) {
    return json(req, {
      error: 'No mappable rows in CSV',
      parsed: realtorRows.length,
      skipped,
    }, 500);
  }

  if (dryRun) {
    return json(req, {
      ok: true,
      dry_run: true,
      source_url: sourceUrl,
      raw_rows: realtorRows.length,
      mapped_rows: statsRowsRaw.length,
      deduped,
      unique_rows: statsRows.length,
      skipped,
      sample: statsRows.slice(0, 3),
      distinct_zips: new Set(statsRows.map((r) => r.zip_code)).size,
      period_months: Array.from(new Set(statsRows.map((r) => r.period_month))).sort(),
      duration_ms: Date.now() - startedAt,
    });
  }

  // 4. Batched upsert
  let upserted = 0;
  for (let i = 0; i < statsRows.length; i += BATCH_SIZE) {
    const batch = statsRows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('market_stats')
      .upsert(batch, { onConflict: 'zip_code,period_month' });
    if (error) {
      return json(req, {
        error: 'Upsert batch failed',
        detail: error.message,
        upserted_so_far: upserted,
        batch_index: Math.floor(i / BATCH_SIZE),
      }, 500);
    }
    upserted += batch.length;
  }

  return json(req, {
    ok: true,
    source_url: sourceUrl,
    raw_rows: realtorRows.length,
    deduped,
    upserted,
    skipped,
    distinct_zips: new Set(statsRows.map((r) => r.zip_code)).size,
    period_months: Array.from(new Set(statsRows.map((r) => r.period_month))).sort(),
    duration_ms: Date.now() - startedAt,
  });
});
