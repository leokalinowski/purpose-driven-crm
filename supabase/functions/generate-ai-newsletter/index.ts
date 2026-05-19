import { buildCorsHeaders } from '../_shared/cors.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * generate-ai-newsletter — Grok-powered draft generator with verified market
 * data injection + image-placeholder generation + area-aware framing.
 *
 * v58: coverage-first ZIP selection (intersect agent ZIPs with market_stats
 *      first, then rank by contact density). Was returning empty data when
 *      the agent's top contacts were in uncovered ZIPs.
 * v59: switched image placeholders from placehold.co to picsum.photos for
 *      real photos.
 * v60: switched picsum (random topic) → LoremFlickr (tag-aware) so the
 *      photos are actually real-estate themed instead of honey/coffee/etc.
 *      LoremFlickr is free, no API key, deterministic with seed, and accepts
 *      tag lists like "realestate,house,home" to constrain topic. Also
 *      tightened the source-citation rule — say "realtor.com" not the
 *      internal table name "realtor.com market_stats".
 * v61: AREA-AWARE generation. Agents now pre-answer 3 questions before the
 *      AI runs:
 *        - Area scope: top_zips | city | state. For city/state, the function
 *          looks up all the agent's contact-ZIPs in that area and aggregates
 *          market_stats into a single area-level summary so newsletters
 *          stop sounding like "ZIP 22301, ZIP 22302, ZIP 22303 …" every
 *          month. Now they say "Alexandria, VA — median list $689K …".
 *        - Audience: buyers | sellers | both | past_clients. Reframes the
 *          body voice and which numbers to lead with (inventory + listings
 *          for buyers; sale price + DOM for sellers; equity + market check
 *          for past clients).
 *        - Goal: schedule_call | reply | visit_site | top_of_mind. Drives
 *          the CTA shape (booking link vs reply prompt vs no-button vs
 *          listings link).
 */

interface MarketStatRow {
  zip_code: string;
  period_month: string;
  median_list_price: number | null;
  median_sale_price: number | null;
  median_dom: number | null;
  inventory: number | null;
  homes_sold: number | null;
  new_listings: number | null;
  avg_price_per_sqft: number | null;
}

type AreaScope = 'top_zips' | 'city' | 'state';

interface AreaParam {
  scope: AreaScope;
  /** City name (case-insensitive) when scope='city'; 2-letter state code when scope='state'. Ignored for top_zips. */
  value?: string;
}

interface MarketDataResult {
  rows: MarketStatRow[];
  /** Display label for the area, e.g. "Alexandria, VA" or "your top ZIP codes". */
  areaLabel: string;
  /** True when scope='city' or 'state' AND we successfully aggregated multiple ZIPs. */
  isAreaAggregate: boolean;
  /** Aggregated values when isAreaAggregate; null when single-ZIP. */
  aggregate: AreaAggregate | null;
}

interface AreaAggregate {
  median_list_price: number | null;
  median_sale_price: number | null;
  median_dom: number | null;
  inventory: number | null;
  homes_sold: number | null;
  new_listings: number | null;
  avg_price_per_sqft: number | null;
  zip_count: number;
  contributing_zips: string[];
  period_month: string;
}

function median(values: Array<number | null | undefined>): number | null {
  const nums = values
    .filter((v): v is number => v != null && !Number.isNaN(Number(v)))
    .map((v) => Number(v))
    .sort((a, b) => a - b);
  if (nums.length === 0) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 === 0 ? (nums[mid - 1] + nums[mid]) / 2 : nums[mid];
}

function sum(values: Array<number | null | undefined>): number | null {
  const nums = values.filter((v): v is number => v != null && !Number.isNaN(Number(v))).map((v) => Number(v));
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0);
}

function aggregateRows(rows: MarketStatRow[]): AreaAggregate {
  return {
    median_list_price: median(rows.map((r) => r.median_list_price)),
    median_sale_price: median(rows.map((r) => r.median_sale_price)),
    median_dom: median(rows.map((r) => r.median_dom)),
    inventory: sum(rows.map((r) => r.inventory)),
    homes_sold: sum(rows.map((r) => r.homes_sold)),
    new_listings: sum(rows.map((r) => r.new_listings)),
    avg_price_per_sqft: median(rows.map((r) => r.avg_price_per_sqft)),
    zip_count: rows.length,
    contributing_zips: rows.map((r) => r.zip_code).sort(),
    period_month: rows[0]?.period_month ?? '',
  };
}

/**
 * Pull market data for the requested area. Returns up to topN per-ZIP rows
 * plus, for city/state scopes, an area-level aggregate so the prompt can
 * cite "Alexandria, VA" instead of "ZIP 22301, ZIP 22302".
 */
async function fetchAgentMarketData(
  supabase: ReturnType<typeof createClient>,
  agentId: string,
  area: AreaParam,
  topN: number = 5,
): Promise<MarketDataResult> {
  // 1. Resolve which ZIPs to consider based on area scope.
  let candidateZips: string[] = [];
  let zipContactCounts: Map<string, number> = new Map();
  let areaLabel = 'your top ZIP codes';

  if (area.scope === 'city' || area.scope === 'state') {
    if (!area.value || !area.value.trim()) {
      // Bad input: fall through to top_zips behavior.
      area = { scope: 'top_zips' };
    }
  }

  if (area.scope === 'city') {
    const cityNorm = area.value!.trim().toLowerCase();
    const { data: rows, error } = await supabase
      .from('contacts')
      .select('zip_code, city, state')
      .eq('agent_id', agentId)
      .not('zip_code', 'is', null)
      .neq('zip_code', '');
    if (error) {
      console.error('[market-data] city query failed:', error);
      return { rows: [], areaLabel: area.value!, isAreaAggregate: false, aggregate: null };
    }
    const matched = (rows ?? []).filter((r: { city?: string | null }) =>
      (r.city ?? '').trim().toLowerCase() === cityNorm,
    );
    if (matched.length === 0) {
      console.log('[market-data] city scope: 0 contacts matched', cityNorm);
      return { rows: [], areaLabel: area.value!, isAreaAggregate: false, aggregate: null };
    }
    const sampleState = (matched.find((r) => r.state)?.state ?? '').trim().toUpperCase();
    const sampleCity = (matched.find((r) => r.city)?.city ?? area.value!).trim();
    const cityProper = sampleCity
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
    areaLabel = sampleState ? `${cityProper}, ${sampleState}` : cityProper;
    for (const r of matched as Array<{ zip_code?: string | null }>) {
      const z = (r.zip_code ?? '').toString().trim().slice(0, 5);
      if (!/^\d{5}$/.test(z)) continue;
      zipContactCounts.set(z, (zipContactCounts.get(z) ?? 0) + 1);
    }
    candidateZips = [...zipContactCounts.keys()];
  } else if (area.scope === 'state') {
    const stateNorm = area.value!.trim().toUpperCase();
    const { data: rows, error } = await supabase
      .from('contacts')
      .select('zip_code, state')
      .eq('agent_id', agentId)
      .not('zip_code', 'is', null)
      .neq('zip_code', '');
    if (error) {
      console.error('[market-data] state query failed:', error);
      return { rows: [], areaLabel: area.value!, isAreaAggregate: false, aggregate: null };
    }
    const matched = (rows ?? []).filter((r: { state?: string | null }) =>
      (r.state ?? '').trim().toUpperCase() === stateNorm,
    );
    if (matched.length === 0) {
      console.log('[market-data] state scope: 0 contacts matched', stateNorm);
      return { rows: [], areaLabel: area.value!, isAreaAggregate: false, aggregate: null };
    }
    areaLabel = stateNorm;
    for (const r of matched as Array<{ zip_code?: string | null }>) {
      const z = (r.zip_code ?? '').toString().trim().slice(0, 5);
      if (!/^\d{5}$/.test(z)) continue;
      zipContactCounts.set(z, (zipContactCounts.get(z) ?? 0) + 1);
    }
    candidateZips = [...zipContactCounts.keys()];
  } else {
    // top_zips: pull every contact ZIP, count, intersect with market_stats later.
    const { data: rows, error } = await supabase
      .from('contacts')
      .select('zip_code')
      .eq('agent_id', agentId)
      .not('zip_code', 'is', null)
      .neq('zip_code', '');
    if (error || !rows) return { rows: [], areaLabel, isAreaAggregate: false, aggregate: null };
    for (const r of rows as Array<{ zip_code?: string | null }>) {
      const z = (r.zip_code ?? '').toString().trim().slice(0, 5);
      if (!/^\d{5}$/.test(z)) continue;
      zipContactCounts.set(z, (zipContactCounts.get(z) ?? 0) + 1);
    }
    candidateZips = [...zipContactCounts.keys()];
  }

  if (candidateZips.length === 0) {
    return { rows: [], areaLabel, isAreaAggregate: false, aggregate: null };
  }

  // 2. Pull market_stats for those ZIPs and dedupe to one (latest) row per ZIP.
  const { data: stats, error: statErr } = await supabase
    .from('market_stats')
    .select('zip_code, period_month, median_list_price, median_sale_price, median_dom, inventory, homes_sold, new_listings, avg_price_per_sqft')
    .in('zip_code', candidateZips)
    .order('period_month', { ascending: false })
    .limit(candidateZips.length * 6);
  if (statErr || !stats) {
    console.error('[market-data] market_stats query failed:', statErr);
    return { rows: [], areaLabel, isAreaAggregate: false, aggregate: null };
  }

  const latestPerZip = new Map<string, MarketStatRow>();
  for (const row of stats as MarketStatRow[]) {
    if (!latestPerZip.has(row.zip_code)) latestPerZip.set(row.zip_code, row);
  }

  if (latestPerZip.size === 0) {
    return { rows: [], areaLabel, isAreaAggregate: false, aggregate: null };
  }

  // 3. For top_zips: rank by contact density, take topN.
  //    For city/state: keep all ZIPs in the area (capped at topN for the
  //    detail block, but ALL contribute to the aggregate).
  const allRows = [...latestPerZip.values()];

  if (area.scope === 'top_zips') {
    const ranked = allRows
      .map((r) => ({ row: r, contactCount: zipContactCounts.get(r.zip_code) ?? 0 }))
      .sort((a, b) => b.contactCount - a.contactCount)
      .slice(0, topN)
      .map((entry) => entry.row);
    console.log('[market-data] top_zips coverage:', JSON.stringify({
      agent_zips: zipContactCounts.size,
      market_stats_overlap: latestPerZip.size,
      selected_top_n: ranked.length,
      selected_zips: ranked.map(r => r.zip_code),
      selected_period: ranked[0]?.period_month ?? null,
    }));
    return { rows: ranked, areaLabel, isAreaAggregate: false, aggregate: null };
  }

  // city/state: aggregate across ALL covered ZIPs in the area, then return
  // up to topN ZIPs (by contact density) for the detail block.
  const detailRows = allRows
    .map((r) => ({ row: r, contactCount: zipContactCounts.get(r.zip_code) ?? 0 }))
    .sort((a, b) => b.contactCount - a.contactCount)
    .slice(0, topN)
    .map((entry) => entry.row);

  const aggregate = aggregateRows(allRows);

  console.log('[market-data]', area.scope, 'aggregate:', JSON.stringify({
    area_label: areaLabel,
    contact_zips_in_area: zipContactCounts.size,
    market_stats_overlap: latestPerZip.size,
    aggregate_zip_count: aggregate.zip_count,
    contributing_zips: aggregate.contributing_zips,
    period: aggregate.period_month,
  }));

  return { rows: detailRows, areaLabel, isAreaAggregate: true, aggregate };
}

function formatUSD(n: number | null): string {
  if (n == null) return 'n/a';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

function formatMonthLabel(period: string): string {
  try {
    const d = new Date(period);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  } catch {
    return period;
  }
}

function formatMarketDataBlock(result: MarketDataResult): string {
  const { rows, areaLabel, isAreaAggregate, aggregate } = result;
  if (rows.length === 0 && !aggregate) {
    return `(No verified market data is available for ${areaLabel}. The agent has either no contacts in this area OR none of those ZIPs are covered by realtor.com data yet.)`;
  }
  const monthLabel = formatMonthLabel(rows[0]?.period_month ?? aggregate?.period_month ?? '');
  const lines: string[] = [];
  lines.push(`Data source: realtor.com (latest available month: ${monthLabel}).`);
  lines.push('');

  if (isAreaAggregate && aggregate) {
    lines.push(`AREA SUMMARY — ${areaLabel} (aggregated across ${aggregate.zip_count} ZIP code${aggregate.zip_count === 1 ? '' : 's'}):`);
    if (aggregate.median_list_price != null) lines.push(`  - Median list price (median across ZIPs): ${formatUSD(aggregate.median_list_price)}`);
    if (aggregate.median_sale_price != null) lines.push(`  - Median sale price (median across ZIPs): ${formatUSD(aggregate.median_sale_price)}`);
    if (aggregate.median_dom != null) lines.push(`  - Median days on market (median across ZIPs): ${Math.round(aggregate.median_dom)}`);
    if (aggregate.inventory != null) lines.push(`  - Active inventory (sum across ZIPs): ${aggregate.inventory.toLocaleString()} listings`);
    if (aggregate.homes_sold != null) lines.push(`  - Homes sold (sum across ZIPs): ${aggregate.homes_sold.toLocaleString()}`);
    if (aggregate.new_listings != null) lines.push(`  - New listings (sum across ZIPs): ${aggregate.new_listings.toLocaleString()}`);
    if (aggregate.avg_price_per_sqft != null) lines.push(`  - Avg price per sq ft (median across ZIPs): ${formatUSD(aggregate.avg_price_per_sqft)}`);
    lines.push('');
    lines.push(`Contributing ZIPs: ${aggregate.contributing_zips.join(', ')}`);
    lines.push('');
    if (rows.length > 0) {
      lines.push(`PER-ZIP DETAIL (use only if calling out a specific neighborhood; lead with the AREA SUMMARY above):`);
      for (const r of rows) {
        const parts: string[] = [];
        if (r.median_list_price != null) parts.push(`list ${formatUSD(Number(r.median_list_price))}`);
        if (r.median_sale_price != null) parts.push(`sale ${formatUSD(Number(r.median_sale_price))}`);
        if (r.median_dom != null) parts.push(`${r.median_dom} DOM`);
        if (r.inventory != null) parts.push(`${r.inventory} listings`);
        lines.push(`  - ZIP ${r.zip_code}: ${parts.join(', ')}`);
      }
    }
  } else {
    // top_zips: per-ZIP detail.
    for (const r of rows) {
      lines.push(`ZIP ${r.zip_code} (${monthLabel}):`);
      if (r.median_list_price != null) lines.push(`  - Median list price: ${formatUSD(Number(r.median_list_price))}`);
      if (r.median_sale_price != null) lines.push(`  - Median sale price: ${formatUSD(Number(r.median_sale_price))}`);
      if (r.median_dom != null) lines.push(`  - Median days on market: ${r.median_dom}`);
      if (r.inventory != null) lines.push(`  - Active inventory: ${r.inventory.toLocaleString()} listings`);
      if (r.homes_sold != null) lines.push(`  - Homes sold (month): ${r.homes_sold.toLocaleString()}`);
      if (r.new_listings != null) lines.push(`  - New listings (month): ${r.new_listings.toLocaleString()}`);
      if (r.avg_price_per_sqft != null) lines.push(`  - Avg price per sq ft: ${formatUSD(Number(r.avg_price_per_sqft))}`);
      lines.push('');
    }
  }

  return lines.join('\n').trim();
}

// ── Audience + goal guidance ────────────────────────────────────────────

type Audience = 'buyers' | 'sellers' | 'both' | 'past_clients';
type Goal = 'schedule_call' | 'reply' | 'visit_site' | 'top_of_mind';

const AUDIENCE_GUIDANCE: Record<Audience, string> = {
  buyers: `AUDIENCE: ACTIVE BUYERS. Frame the newsletter for someone shopping right now or in the next 6-12 months. Lead with inventory levels, new listings, days on market, and price-per-sqft (these answer "what can I get for my budget right now?"). Tone: encouraging without being pushy. Suggest concrete next steps like "set up a saved search" or "tour a couple comps".`,
  sellers: `AUDIENCE: PROSPECTIVE SELLERS / HOMEOWNERS THINKING ABOUT LISTING. Lead with median sale prices, days on market, and how listings are performing (sale-vs-list). Frame numbers around "what your home might be worth" and "how fast it would move". Suggest a no-pressure home valuation conversation.`,
  both: `AUDIENCE: A MIX OF POTENTIAL BUYERS AND SELLERS. Cover both sides of the market briefly — inventory + new listings for the buy side, sale prices + DOM for the sell side. Don't try to do too much; pick 1 fact per side and weave them together as "the state of the market".`,
  past_clients: `AUDIENCE: PAST CLIENTS (people the agent has already helped buy or sell). This is a relationship-warming check-in, not a pitch. Speak to current homeowners — "your home equity in this market", "if you've thought about your next move" — and leave a clear opening for them to reply or refer a friend. Avoid hard sales language entirely.`,
};

const GOAL_GUIDANCE: Record<Goal, string> = {
  schedule_call: `PRIMARY GOAL: get the reader on a 15-minute call. The CTA button should say something like "Book a 15-min market call" and the body copy should set up the call as low-friction ("no agenda, just 15 minutes"). Set button.url to "#" — the server will inject the agent's real scheduling link before sending.`,
  reply: `PRIMARY GOAL: get a reply to this email. End with a direct question, e.g. "What's your top question about the market right now? Hit reply — I read every one." Include a button labeled "Reply now" or similar; set button.url to "#" — the server will inject the correct mailto: link.`,
  visit_site: `PRIMARY GOAL: drive traffic to the agent's website / listings page. CTA button should say something like "See current listings" or "Browse homes for sale". Set button.url to "#" — the server will inject the agent's website URL.`,
  top_of_mind: `PRIMARY GOAL: just stay top-of-mind with the sphere — no hard ask. The newsletter should feel like a friendly market check-in. DO NOT include a button block — the server will drop it anyway. The agent_bio block at the end is the contact info.`,
};

const TONE_GUIDANCE: Record<string, string> = {
  warm: 'Warm and personal. Write like you\'re talking to a friend over coffee. First-person, contractions, light humor when natural.',
  professional: 'Professional and polished. Confident expertise without being stiff. Avoid jargon; explain things plainly.',
  casual: 'Casual and conversational. Loose, chatty, sentences can be short. Don\'t worry about formality.',
  authoritative: 'Authoritative and data-driven. Lead with numbers and evidence; speak as the local market expert.',
};

const LENGTH_GUIDANCE: Record<string, string> = {
  short: '4-5 blocks total. Tight intro paragraph (2-3 sentences max), one content section, one image break, one CTA. Designed for quick read.',
  medium: '6-8 blocks total. Intro paragraph, 1 hero image, 2 content sections (each 1-2 paragraphs) separated by a divider, CTA, divider, agent bio. Balanced read.',
  long: '9-12 blocks total. Substantial intro, 1 hero image, 3 content sections with depth (separated by dividers/spacers), 1-2 inline images breaking up the text, CTA, divider, agent bio. Deep value.',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: buildCorsHeaders(req) });
  }

  try {
    const XAI_API_KEY = Deno.env.get('XAI_API_KEY');
    if (!XAI_API_KEY) throw new Error('XAI_API_KEY not configured');
    const XAI_MODEL = Deno.env.get('XAI_MODEL') ?? 'grok-4-1-fast-reasoning';

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization');
    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) throw new Error('Unauthorized');

    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();
    const isAdmin = !!userRole;

    const body = await req.json();
    const {
      agent_id, topic_hint, custom_prompt, tone, length,
      area, audience, goal,
    }: {
      agent_id?: string;
      topic_hint?: string;
      custom_prompt?: string;
      tone?: 'warm' | 'professional' | 'casual' | 'authoritative';
      length?: 'short' | 'medium' | 'long';
      area?: AreaParam;
      audience?: Audience;
      goal?: Goal;
    } = body ?? {};

    const effectiveAgentId = isAdmin ? (agent_id || user.id) : user.id;
    if (agent_id && agent_id !== user.id && !isAdmin) {
      throw new Error('You can only generate newsletters for yourself');
    }

    const effectiveTopic = (custom_prompt && custom_prompt.trim())
      || (topic_hint && topic_hint.trim())
      || '';

    const resolvedArea: AreaParam =
      area && (area.scope === 'city' || area.scope === 'state' || area.scope === 'top_zips')
        ? area
        : { scope: 'top_zips' };

    const resolvedAudience: Audience = audience && AUDIENCE_GUIDANCE[audience] ? audience : 'both';
    const resolvedGoal: Goal = goal && GOAL_GUIDANCE[goal] ? goal : 'top_of_mind';
    const resolvedTone = tone && TONE_GUIDANCE[tone] ? tone : 'warm';
    const resolvedLength = length && LENGTH_GUIDANCE[length] ? length : 'medium';

    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name, full_name, email, phone_number, brokerage, office_address, website, license_number')
      .eq('user_id', effectiveAgentId)
      .maybeSingle();
    const agentName = profile?.full_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Agent';

    const { data: marketing } = await supabase
      .from('agent_marketing_settings')
      .select('brand_guidelines, tone_guidelines, gpt_prompt, target_audience, what_not_to_say, example_copy, primary_color, secondary_color, headshot_url, logo_colored_url, scheduling_url')
      .eq('user_id', effectiveAgentId)
      .maybeSingle();

    const { count: contactCount } = await supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('agent_id', effectiveAgentId)
      .not('email', 'is', null)
      .neq('email', '');

    const marketResult = await fetchAgentMarketData(supabase, effectiveAgentId, resolvedArea, 5);
    const marketDataBlock = formatMarketDataBlock(marketResult);
    const hasVerifiedData = marketResult.rows.length > 0 || marketResult.aggregate != null;

    const primaryColor = marketing?.primary_color || '#2563eb';
    const secondaryColor = marketing?.secondary_color || '#1e40af';

    // ── Numbers guardrail (v60 policy, lightly extended for area aggregates) ──
    const NUMBERS_GUARDRAIL = `
=== NUMBERS-ACCURACY POLICY (HIGHEST PRIORITY — NEVER OVERRIDE) ===

You will be given a VERIFIED MARKET DATA block below. The numbers in that block are the only specific real estate statistics you are allowed to cite in this newsletter. Treat all other numbers as forbidden.

ABSOLUTE RULES:
1. Do NOT invent prices, inventory counts, days on market, percentage changes, year-over-year deltas, or any other specific real estate statistic that is not in the VERIFIED MARKET DATA block.
2. Do NOT cite "national averages", "industry data", "recent reports", or any external statistic. The reader trusts this newsletter because it's local.
3. If the VERIFIED MARKET DATA block contains "(No verified market data is available…)", write the newsletter QUALITATIVELY:
   - Use phrases like "in our market", "this season", "recently", "many sellers".
   - Do NOT manufacture specifics like "prices are up 12%" or "average DOM is 28 days".
   - It is BETTER to be slightly vague and accurate than specific and wrong.
4. When you DO cite numbers from the data block, you MUST include them. The agent specifically wants to give their sphere local data. If the block has numbers, work AT LEAST 2-3 of them naturally into the body copy.
5. If the data block has an AREA SUMMARY (it will be labeled as such — appears for city- or state-scoped newsletters), LEAD WITH the area-level numbers (e.g. "Across Alexandria, the median sale price was $689K…") and use the per-ZIP detail only when calling out a specific neighborhood. Do NOT just list every ZIP in a row — the whole point is to talk about the AREA.
6. If the data block has only PER-ZIP rows (top_zips scope), do NOT generalize a single ZIP's number to "the area" — cite the ZIP each number came from (e.g. "Median sale prices in 21044 sat at $605K last month…").
7. Year-over-year comparisons are forbidden unless the data block contains both the current AND prior-year value for the same area. We currently provide only the latest month, so YoY comparisons are not possible — do not invent them.
8. SOURCE-CITATION FORMAT (very important): if you mention the source, write it as "realtor.com" — NEVER as "realtor.com market_stats", "market_stats", or any database/table-style name. The data block has a natural-language source line for you to mirror. Examples of GOOD: "Per realtor.com…", "realtor.com data shows…", "the latest realtor.com numbers indicate…". Examples of BAD: "According to realtor.com market_stats…", "the market_stats table shows…".
9. Citation is OPTIONAL — it's perfectly fine to weave the numbers in without naming the source at all. If you DO name a source, follow rule 8.

If you violate any of these rules, the newsletter will be rejected and the agent's trust with their sphere will be damaged. Accuracy outweighs creative flair every time.

=== VERIFIED MARKET DATA ===
${marketDataBlock}
=== END VERIFIED MARKET DATA ===
`;

    const IMAGE_GUIDANCE = `
=== VISUAL LAYOUT GUIDANCE ===

Don't write a wall of text. A great newsletter has 1–3 images and visual breaks (dividers + spacers) that make it feel scannable. Be opinionated.

IMAGE PLACEHOLDERS — USE THIS EXACT URL FORMAT:
https://loremflickr.com/{WIDTH}/{HEIGHT}/{TAGS}

Where:
- {TAGS} is a comma-separated list (no spaces) drawn from this curated set:
    realestate, neighborhood, suburb, architecture, livingroom,
    kitchen, modernhome, traditionalhome, cityskyline, downtown, condo,
    apartment, exterior, interior, mansion, bungalow, townhouse, skyline
- AVOID these tags — they tend to surface seasonal/holiday photos: house,
  home, frontdoor, porch, garden, yard, family, forsalesign, openhouse.
  Prefer the architectural / area / interior-design tags above.
- Pick 2–3 tags that match what the image SHOULD show. Examples:
    * Hero image about market activity → "realestate,neighborhood,architecture"
    * Section image about home prep → "livingroom,modernhome,interior"
    * Section image about a suburb → "suburb,neighborhood,exterior"
    * Section image about downtown condos → "condo,cityskyline,downtown"
- {WIDTH}x{HEIGHT}: 1200x500 for full-width hero, 800x300 for inline breaks.

CACHE-BUSTING — REQUIRED ON EVERY IMAGE:
Append a unique ?lock=<random-integer> to every image URL. Without this,
email clients cache the same photo across all images. Use a different
integer 1–999999 for each image block in this newsletter.
   GOOD: https://loremflickr.com/1200/500/realestate,neighborhood,architecture?lock=84321
   GOOD: https://loremflickr.com/800/300/livingroom,modernhome,interior?lock=22918
   BAD:  https://loremflickr.com/1200/500/realestate,house,home   (no lock — same photo every time)

If the newsletter has multiple image blocks, each block must use DIFFERENT
tags AND a DIFFERENT lock value so they don't all show the same photo.

NEVER use placehold.co or picsum.photos URLs — those produce gray boxes or off-topic random photos. The agent will report it as broken.

ALT TEXT: always set alt text describing what the FINAL image should show (e.g. alt: "Spring market activity in Alexandria"). This helps the agent decide whether to swap with their own photo.

IMAGE PROPS:
- align: "center" for hero, "center" for inline breaks
- width: "100%" for hero, "80%" for inline breaks
- borderRadius: 8

DIVIDERS AND SPACERS:
- Use a divider between major content sections.
- Use a spacer (height: 24-32px) before and after the agent_bio block.
- Don't overuse — use them like chapter breaks, not paragraph separators.

GOOD STRUCTURE EXAMPLE FOR A MEDIUM NEWSLETTER:
  1. heading (the title)
  2. text (intro)
  3. image (hero photo — src: https://loremflickr.com/1200/500/realestate,neighborhood,architecture?lock=12345)
  4. heading (section 1)
  5. text (section 1 body)
  6. divider
  7. heading (section 2)
  8. text (section 2 body)
  9. button (CTA)
  10. spacer
  11. agent_bio
`;

    // Build a friendly area-context line for the prompt summary.
    const areaSummaryLine = (() => {
      if (resolvedArea.scope === 'city' || resolvedArea.scope === 'state') {
        return hasVerifiedData
          ? `This newsletter is FOCUSED ON: ${marketResult.areaLabel}. Mention this area by name in the headline and intro so the reader knows it's about THEIR neighborhood, not a generic update.`
          : `This newsletter was requested to focus on: ${marketResult.areaLabel}, but no verified market data is available for that area yet. Write qualitatively about the area and AVOID inventing statistics.`;
      }
      return `This newsletter is a market update for the agent's top ZIP codes. ${hasVerifiedData ? 'Cite the specific ZIPs you reference.' : ''}`;
    })();

    const audienceLine = AUDIENCE_GUIDANCE[resolvedAudience];
    const goalLine = GOAL_GUIDANCE[resolvedGoal];

    const systemPrompt = `You are a professional real estate newsletter copywriter. Generate engaging email newsletter content for ${agentName}${profile?.brokerage ? ` at ${profile.brokerage}` : ''}.

${NUMBERS_GUARDRAIL}

${IMAGE_GUIDANCE}

=== AREA / AUDIENCE / GOAL FOR THIS DRAFT ===
${areaSummaryLine}
${audienceLine}
${goalLine}
=== END AREA / AUDIENCE / GOAL ===

${marketing?.gpt_prompt ? `CREATIVE DIRECTION: ${marketing.gpt_prompt}` : ''}
${marketing?.brand_guidelines ? `BRAND GUIDELINES: ${marketing.brand_guidelines}` : ''}
${marketing?.tone_guidelines ? `BRAND TONE GUIDELINES: ${marketing.tone_guidelines}` : ''}
VOICE FOR THIS DRAFT: ${TONE_GUIDANCE[resolvedTone]}
LENGTH FOR THIS DRAFT: ${LENGTH_GUIDANCE[resolvedLength]}
${marketing?.target_audience ? `BRAND TARGET AUDIENCE (background context): ${marketing.target_audience}` : ''}
${marketing?.what_not_to_say ? `DO NOT SAY OR INCLUDE: ${marketing.what_not_to_say}` : ''}
${marketing?.example_copy ? `STYLE REFERENCE (match this voice): ${marketing.example_copy}` : ''}
${effectiveTopic ? `TOPIC/THEME FOR THIS NEWSLETTER: ${effectiveTopic}` : 'Use the AREA / AUDIENCE / GOAL above to drive the angle.'}

AGENT DETAILS:
- Name: ${agentName}
- Email: ${profile?.email || 'N/A'}
- Phone: ${profile?.phone_number || 'N/A'}
- Brokerage: ${profile?.brokerage || 'N/A'}
- Website: ${profile?.website || 'N/A'}
- Database size: ${contactCount || 0} contacts with email

Use primary brand color ${primaryColor} for buttons and accent elements.
Use secondary brand color ${secondaryColor} for secondary elements.

Generate a complete newsletter that follows the LENGTH FOR THIS DRAFT and VISUAL LAYOUT GUIDANCE. ${hasVerifiedData ? `You have verified market numbers above. Use them precisely. AT LEAST 2-3 specific numbers from the data block must appear naturally in the body copy.` : 'You have no verified market numbers — write qualitatively and DO NOT invent statistics.'}

The newsletter should feel personal and valuable, not salesy. Focus on providing genuine value to the reader.`;

    const jsonInstruction = `

Respond with a JSON object exactly matching this shape:
{
  "subject": "<compelling subject under 60 chars>",
  "blocks": [
    { "type": "heading|text|image|button|divider|spacer|agent_bio|social_icons", "props": { ... } }
  ]
}

Block prop shapes:
- heading: { text, level (1-4), align, color }
- text: { html (HTML with <p> tags), align, color, fontSize }
- image: { src (use https://loremflickr.com/{w}/{h}/{tags}), alt, width (e.g. "100%" or "80%"), align ("left"|"center"|"right"), borderRadius, linkUrl }
- button: { text, url, backgroundColor, textColor, align, borderRadius, fullWidth }
- divider: { color, thickness, style, width }
- spacer: { height (px) }
- agent_bio: { layout, showHeadshot, showLogo, showPhone, showEmail, showLicense, showBrokerage, showOfficeAddress, showOfficePhone, showWebsite, showEqualHousing }
- social_icons: { align, iconSize, links }

No prose outside the JSON. Include AT LEAST ONE image block with a https://loremflickr.com/.../tags URL so the agent gets a real-estate-themed photo starting point.`;

    const aiResponse = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${XAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: XAI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt + jsonInstruction },
          { role: 'user', content: 'Generate the newsletter now. Return the complete blocks array and a compelling subject line. Remember: only cite numbers from the VERIFIED MARKET DATA block (and never write "market_stats" — say "realtor.com"), lead with the AREA SUMMARY when present, and use loremflickr.com URLs for image placeholders so the photo is actually real-estate-themed.' },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('xAI error:', aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }), {
          status: 429, headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`xAI returned ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log('AI response structure:', JSON.stringify({
      hasChoices: !!aiData.choices,
      finishReason: aiData.choices?.[0]?.finish_reason,
      hasContent: !!aiData.choices?.[0]?.message?.content,
      tone: resolvedTone,
      length: resolvedLength,
      area_scope: resolvedArea.scope,
      area_value: resolvedArea.value ?? null,
      area_label: marketResult.areaLabel,
      audience: resolvedAudience,
      goal: resolvedGoal,
      market_data_zips: marketResult.rows.map(r => r.zip_code),
      market_data_period: marketResult.rows[0]?.period_month ?? marketResult.aggregate?.period_month ?? null,
      is_area_aggregate: marketResult.isAreaAggregate,
    }));

    const message = aiData.choices?.[0]?.message;
    let generated: any;
    if (message?.content) {
      try { generated = JSON.parse(message.content); }
      catch {
        const jsonMatch = message.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try { generated = JSON.parse(jsonMatch[0]); }
          catch (parseError) { console.error('Content JSON parse failed:', jsonMatch[0].substring(0, 200)); }
        }
      }
    }
    if (!generated?.blocks) {
      console.error('AI response:', JSON.stringify(aiData).slice(0, 500));
      throw new Error('AI did not return valid newsletter blocks');
    }
    const subject = generated.subject || 'Monthly Newsletter';

    // ── Defensive image + text rewrites ─────────────────────────────────
    //
    // Image URL hygiene:
    //   1. If Grok emitted placehold.co or picsum.photos (older patterns),
    //      rewrite to loremflickr with tags derived from alt text.
    //   2. Strip seasonal/holiday-prone tags ("house", "home", "frontdoor",
    //      "porch", "garden", "yard", "family", "forsalesign", "openhouse")
    //      from any loremflickr URL — those keywords surface Christmas-
    //      decorated houses, cluttered family photos, etc. on Flickr's
    //      popular-photo bias.
    //   3. ALWAYS inject a fresh ?lock=<random> on every loremflickr URL
    //      so each image is distinct AND email clients cache it correctly
    //      (without lock, same URL → same cached photo across all blocks).
    //
    // Text hygiene:
    //   - Strip "market_stats" leaks (table name) → "realtor.com".

    const SAFE_TAGS = [
      'realestate', 'neighborhood', 'suburb', 'architecture', 'livingroom',
      'kitchen', 'modernhome', 'traditionalhome', 'cityskyline', 'downtown',
      'condo', 'apartment', 'exterior', 'interior', 'mansion', 'bungalow',
      'townhouse', 'skyline',
    ];
    const SEASONAL_TAGS = new Set([
      'house', 'home', 'frontdoor', 'porch', 'garden', 'yard', 'family',
      'forsalesign', 'openhouse', 'christmas', 'holiday', 'winter',
    ]);

    function deriveTagsFromAlt(alt: string): string[] {
      const a = alt.toLowerCase();
      const tags = SAFE_TAGS.filter((t) => a.includes(t));
      return (tags.length ? tags : ['realestate', 'neighborhood', 'architecture']).slice(0, 3);
    }

    function rewriteLoremFlickrUrl(url: string, alt: string, imageIndex: number): string {
      // Pull width/height/tags from the URL, drop any existing query string.
      const m = url.match(/loremflickr\.com\/(\d+)\/(\d+)\/([^?]+)/i);
      let width = '1200';
      let height = '500';
      let tags: string[] = [];
      if (m) {
        width = m[1];
        height = m[2];
        tags = m[3].split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
      }
      // Drop seasonal/holiday-prone tags.
      tags = tags.filter((t) => !SEASONAL_TAGS.has(t));
      // If we stripped too many, rebuild from alt-text keywords.
      if (tags.length === 0) {
        tags = deriveTagsFromAlt(alt);
      }
      // Cap at 3 tags for clean URLs.
      tags = tags.slice(0, 3);
      // Lock seed: combine image index + crypto random so each block is
      // guaranteed distinct even if Grok used identical tags.
      const lockSeed = imageIndex * 1000 + Math.floor(Math.random() * 999) + 1;
      return `https://loremflickr.com/${width}/${height}/${tags.join(',')}?lock=${lockSeed}`;
    }

    // ── Goal-aware button URL enforcement ──────────────────────────────
    //
    // Grok hallucinates URLs (or uses '#') for non-website goals. We
    // override its url with a real action based on the resolved goal:
    //
    //   schedule_call → marketing.scheduling_url (Calendly/Cal.com/etc.)
    //                   FALLBACK: mailto:agent.email if no scheduling_url
    //   reply         → mailto:agent.email?subject=Re:<newsletter subject>
    //   visit_site    → profile.website (or whatever Grok set, if it's a
    //                   real http URL — agents may have a custom landing
    //                   page they want featured)
    //   top_of_mind   → DROP the button entirely. Goal copy says no hard
    //                   ask; the agent_bio block is the contact info.
    //
    // For every button, we keep Grok's text (it crafted a goal-appropriate
    // CTA label) but force the URL.
    function isHttpUrl(u: string | undefined): boolean {
      if (!u) return false;
      const s = u.trim().toLowerCase();
      return s.startsWith('http://') || s.startsWith('https://');
    }

    function buttonUrlForGoal(blockUrl: string | undefined): string | null {
      const subj = encodeURIComponent(`Re: ${subject}`);
      const agentEmail = profile?.email?.trim();
      switch (resolvedGoal) {
        case 'schedule_call': {
          const sched = (marketing?.scheduling_url ?? '').trim();
          if (isHttpUrl(sched)) return sched;
          if (agentEmail) return `mailto:${agentEmail}?subject=${subj}%20-%20Schedule%20a%20call`;
          return null;
        }
        case 'reply': {
          if (agentEmail) return `mailto:${agentEmail}?subject=${subj}`;
          return null;
        }
        case 'visit_site': {
          const site = (profile?.website ?? '').trim();
          if (isHttpUrl(site)) return site;
          // Fall through to whatever Grok set (might be a landing page)
          if (isHttpUrl(blockUrl)) return blockUrl!;
          if (agentEmail) return `mailto:${agentEmail}`;
          return null;
        }
        case 'top_of_mind':
        default:
          return null; // signal: drop the button
      }
    }

    let imageIndex = 0;
    const blocksWithIds = (generated.blocks || []).flatMap((block: any) => {
      const isImage = block.type === 'image';
      const isButton = block.type === 'button';
      let nextSrc: string | undefined = block.props?.src;

      if (isImage && typeof nextSrc === 'string') {
        const alt = (block.props?.alt as string | undefined) ?? '';

        // Step 1: rewrite legacy hosts to loremflickr with alt-derived tags.
        if (nextSrc.includes('placehold.co') || nextSrc.includes('picsum.photos')) {
          const derivedTags = deriveTagsFromAlt(alt);
          nextSrc = `https://loremflickr.com/1200/500/${derivedTags.join(',')}`;
        }

        // Step 2: every loremflickr URL gets cleaned tags + a unique lock.
        if (nextSrc.includes('loremflickr.com')) {
          nextSrc = rewriteLoremFlickrUrl(nextSrc, alt, imageIndex);
          imageIndex++;
        }
      }

      // Goal-aware button URL: drop or rewrite.
      let nextButtonUrl: string | null | undefined = undefined;
      if (isButton) {
        nextButtonUrl = buttonUrlForGoal(block.props?.url);
        if (nextButtonUrl === null) {
          // top_of_mind, or no agent_email + no scheduling_url. Drop the
          // button rather than ship a broken '#' link.
          return [];
        }
      }

      let nextHtml: string | undefined = block.type === 'text' ? block.props?.html : undefined;
      if (typeof nextHtml === 'string' && /market_stats/i.test(nextHtml)) {
        nextHtml = nextHtml.replace(/realtor\.com\s+market_stats/gi, 'realtor.com')
                            .replace(/market_stats/gi, 'realtor.com');
      }
      return [{
        ...block,
        id: crypto.randomUUID(),
        props: {
          ...block.props,
          ...(isImage && nextSrc ? { src: nextSrc } : {}),
          ...(isButton && nextButtonUrl ? { url: nextButtonUrl } : {}),
          ...(nextHtml ? { html: nextHtml } : {}),
          ...(block.type === 'heading' && !block.props?.color ? { color: primaryColor } : {}),
          ...(block.type === 'button' && !block.props?.backgroundColor ? { backgroundColor: primaryColor } : {}),
        },
      }];
    });

    const globalStyles = {
      backgroundColor: '#f4f4f5',
      contentWidth: 600,
      fontFamily: 'Georgia, serif',
      bodyColor: '#1a1a1a',
    };

    const { data: template, error: insertError } = await supabase
      .from('newsletter_templates')
      .insert({
        agent_id: effectiveAgentId,
        name: `AI Draft: ${subject}`,
        blocks_json: blocksWithIds,
        global_styles: globalStyles,
        is_active: false,
        ai_generated: true,
        review_status: 'pending_review',
        created_by: user.id,
      })
      .select('id')
      .single();
    if (insertError) throw insertError;

    try {
      await supabase.from('agent_action_items').insert({
        agent_id: user.id,
        item_type: 'newsletter_review',
        title: `Review AI Newsletter for ${agentName}`,
        description: `An AI-generated newsletter draft "${subject}" is ready for review and editing before sending.${hasVerifiedData ? ` Includes verified market data for ${marketResult.areaLabel}.` : ' (No market data available — written qualitatively.)'}`,
        action_url: `/newsletter-builder/${template.id}`,
        priority: 'medium',
      });
    } catch (actionItemErr) {
      console.warn('Could not create action item (non-fatal):', actionItemErr);
    }

    const imageBlockCount = blocksWithIds.filter((b: any) => b.type === 'image').length;

    return new Response(JSON.stringify({
      success: true,
      template_id: template.id,
      subject,
      block_count: blocksWithIds.length,
      image_placeholder_count: imageBlockCount,
      tone: resolvedTone,
      length: resolvedLength,
      area_scope: resolvedArea.scope,
      area_label: marketResult.areaLabel,
      audience: resolvedAudience,
      goal: resolvedGoal,
      is_area_aggregate: marketResult.isAreaAggregate,
      market_data_zips: marketResult.rows.map(r => r.zip_code),
      market_data_period: marketResult.rows[0]?.period_month ?? marketResult.aggregate?.period_month ?? null,
      market_data_used: hasVerifiedData,
    }), {
      headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('generate-ai-newsletter error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' },
    });
  }
});
