/**
 * metricool-admin-bulk-connect — admin-only one-shot import that wires every
 * agent with a stored `metricool_brand_id` into the new `metricool_brands`
 * table using ONE master Metricool token.
 *
 * Why this exists:
 *   The legacy admin flow stored each agent's blog_id in
 *   `agent_marketing_settings.metricool_brand_id`. The new REST integration
 *   needs each agent's blog_id PAIRED with a userToken + userId. Since one
 *   Metricool user can manage many brands, the admin's master credentials
 *   work for all of them. This fn does the verify+insert per agent in one
 *   call instead of the admin clicking through the BYO form 9 times.
 *
 * Auth: caller must be authenticated AND have role='admin'. Service role
 * key is NOT accepted — this is a UI-triggered admin action.
 *
 * Body:
 *   { user_token: string, user_id_metricool: number | string, dry_run?: boolean }
 *
 * Behavior:
 *   1. Validate the master credentials by calling /admin/simpleProfiles.
 *   2. Pull every row in `agent_marketing_settings` where
 *      `metricool_brand_id` is set AND no row exists yet in
 *      `metricool_brands` for that agent.
 *   3. For each agent: confirm the blog_id is in the master user's
 *      profile list; fetch connected networks via /v2/settings/brands;
 *      upsert the row (provisioning_method='admin_imported').
 *
 * Returns per-agent report:
 *   {
 *     ok: true,
 *     summary: { imported, skipped, failed, totalCandidates },
 *     results: [
 *       { agent_id, agent_name, blog_id, status: 'imported'|'skipped'|'failed', reason?, networks }
 *     ]
 *   }
 */

import { buildCorsHeaders } from '../_shared/cors.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const METRICOOL_BASE_URL = 'https://app.metricool.com/api';

interface BulkRequest {
  user_token?: string;
  user_id_metricool?: number | string;
  dry_run?: boolean;
}

interface ProfileRow {
  agent_id: string;
  agent_name: string;
  agent_email: string | null;
  blog_id: string;
}

interface ResultEntry {
  agent_id: string;
  agent_name: string;
  blog_id: number;
  status: 'imported' | 'skipped' | 'failed';
  reason?: string;
  networks: string[];
}

function jsonResponse(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' },
  });
}

function extractConnectedNetworks(settings: unknown): string[] {
  if (!settings || typeof settings !== 'object') return [];
  const root = settings as Record<string, unknown>;
  const conns = (root.connections ?? root.networks ?? root) as Record<string, unknown>;
  if (typeof conns !== 'object' || conns == null) return [];
  const out: string[] = [];
  for (const [key, val] of Object.entries(conns)) {
    if (val && typeof val === 'object') {
      const v = val as Record<string, unknown>;
      if (v.token || v.id || v.handle || v.username || v.connected === true) out.push(key);
    } else if (typeof val === 'string' && val.length > 0) {
      out.push(key);
    }
  }
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: buildCorsHeaders(req) });
  if (req.method !== 'POST') return jsonResponse(req, { ok: false, error: 'Method not allowed' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // --- Verify caller is admin -----------------------------------------
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.toLowerCase().startsWith('bearer ')) {
      return jsonResponse(req, { ok: false, error: 'Missing bearer token' }, 401);
    }
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return jsonResponse(req, { ok: false, error: 'Unauthorized' }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: roleRow, error: roleErr } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userData.user.id)
      .eq('role', 'admin')
      .maybeSingle();
    if (roleErr) {
      return jsonResponse(req, { ok: false, error: 'Role lookup failed', detail: roleErr.message }, 500);
    }
    if (!roleRow) {
      return jsonResponse(req, { ok: false, error: 'Admin only' }, 403);
    }

    // --- Parse body ----------------------------------------------------
    let body: BulkRequest;
    try { body = await req.json(); } catch {
      return jsonResponse(req, { ok: false, error: 'Invalid JSON body' }, 400);
    }
    const userToken = (body.user_token ?? '').trim();
    const metricoolUserId = String(body.user_id_metricool ?? '').trim();
    const dryRun = body.dry_run === true;

    if (!userToken || !metricoolUserId) {
      return jsonResponse(req, { ok: false, error: 'user_token and user_id_metricool are both required' }, 400);
    }
    if (!/^\d+$/.test(metricoolUserId)) {
      return jsonResponse(req, { ok: false, error: 'user_id_metricool must be an integer' }, 400);
    }

    // --- Step 1: validate master creds via /admin/simpleProfiles -------
    const profilesUrl = new URL(`${METRICOOL_BASE_URL}/admin/simpleProfiles`);
    profilesUrl.searchParams.set('userId', metricoolUserId);

    let profilesRes: Response;
    try {
      profilesRes = await fetch(profilesUrl.toString(), {
        method: 'GET',
        headers: { 'X-Mc-Auth': userToken, Accept: 'application/json' },
      });
    } catch (err) {
      return jsonResponse(
        req,
        { ok: false, error: 'Could not reach Metricool', detail: err instanceof Error ? err.message : String(err) },
        200,
      );
    }
    if (profilesRes.status === 401 || profilesRes.status === 403) {
      return jsonResponse(req, { ok: false, error: 'Invalid master credentials. Verify the User Token + User ID at app.metricool.com → User Settings → API access.' }, 200);
    }
    if (!profilesRes.ok) {
      const text = await profilesRes.text();
      return jsonResponse(req, { ok: false, error: `Metricool returned ${profilesRes.status}`, detail: text.slice(0, 500) }, 200);
    }
    let profiles: unknown;
    try { profiles = await profilesRes.json(); }
    catch { return jsonResponse(req, { ok: false, error: 'Metricool /admin/simpleProfiles response was not JSON' }, 200); }

    const profileList = Array.isArray(profiles)
      ? profiles
      : Array.isArray((profiles as { brands?: unknown[] })?.brands)
        ? (profiles as { brands: unknown[] }).brands
        : [];

    // Build a Set of all blog_ids accessible to this master user.
    const accessibleBlogIds = new Set<number>();
    const blogIdLabels = new Map<number, string>();
    for (const b of profileList as Array<{ id?: number; blogId?: number; profileId?: number; label?: string }>) {
      const bid = b?.id ?? b?.blogId ?? b?.profileId;
      if (bid != null) {
        const n = Number(bid);
        if (Number.isFinite(n)) {
          accessibleBlogIds.add(n);
          if (b.label) blogIdLabels.set(n, b.label);
        }
      }
    }

    if (accessibleBlogIds.size === 0) {
      return jsonResponse(req, {
        ok: false,
        error: `Master credentials work, but the user has no brands. Got ${profileList.length} entries with no usable id.`,
      }, 200);
    }

    // --- Step 2: pull candidates from agent_marketing_settings ---------
    const { data: candidates, error: candErr } = await adminClient
      .from('agent_marketing_settings')
      .select('user_id, metricool_brand_id')
      .not('metricool_brand_id', 'is', null)
      .neq('metricool_brand_id', '');
    if (candErr) {
      return jsonResponse(req, { ok: false, error: 'Could not load candidates', detail: candErr.message }, 500);
    }

    // Get profile names + emails for the report.
    const candidateAgentIds = (candidates ?? []).map((c) => c.user_id);
    const { data: profileRows } = await adminClient
      .from('profiles')
      .select('user_id, full_name, first_name, last_name, email')
      .in('user_id', candidateAgentIds);
    const profileById = new Map<string, { name: string; email: string | null }>();
    for (const p of (profileRows ?? []) as Array<{ user_id: string; full_name: string | null; first_name: string | null; last_name: string | null; email: string | null }>) {
      const name = p.full_name
        || [p.first_name, p.last_name].filter(Boolean).join(' ')
        || `Agent ${p.user_id.slice(0, 8)}`;
      profileById.set(p.user_id, { name, email: p.email });
    }

    // Skip agents already in metricool_brands (avoid clobbering existing connections).
    const { data: existingRows } = await adminClient
      .from('metricool_brands')
      .select('agent_id')
      .in('agent_id', candidateAgentIds);
    const existingAgentIds = new Set((existingRows ?? []).map((r: { agent_id: string }) => r.agent_id));

    const allCandidates: ProfileRow[] = (candidates ?? []).map((c: { user_id: string; metricool_brand_id: string }) => ({
      agent_id: c.user_id,
      agent_name: profileById.get(c.user_id)?.name ?? `Agent ${c.user_id.slice(0, 8)}`,
      agent_email: profileById.get(c.user_id)?.email ?? null,
      blog_id: c.metricool_brand_id,
    }));

    // --- Step 3: process each candidate --------------------------------
    const results: ResultEntry[] = [];
    for (const cand of allCandidates) {
      const blogIdNum = Number(cand.blog_id);
      if (!Number.isFinite(blogIdNum)) {
        results.push({
          agent_id: cand.agent_id, agent_name: cand.agent_name, blog_id: 0,
          status: 'failed', reason: `Invalid blog_id "${cand.blog_id}"`, networks: [],
        });
        continue;
      }
      if (existingAgentIds.has(cand.agent_id)) {
        results.push({
          agent_id: cand.agent_id, agent_name: cand.agent_name, blog_id: blogIdNum,
          status: 'skipped', reason: 'Already connected — disconnect first to re-import', networks: [],
        });
        continue;
      }
      if (!accessibleBlogIds.has(blogIdNum)) {
        results.push({
          agent_id: cand.agent_id, agent_name: cand.agent_name, blog_id: blogIdNum,
          status: 'failed', reason: 'Blog ID not in this master user\'s brand list', networks: [],
        });
        continue;
      }

      // Best-effort fetch of connected networks. Failure non-fatal.
      let networks: string[] = [];
      try {
        const settingsUrl = new URL(`${METRICOOL_BASE_URL}/v2/settings/brands`);
        settingsUrl.searchParams.set('userId', metricoolUserId);
        settingsUrl.searchParams.set('blogId', String(blogIdNum));
        const settingsRes = await fetch(settingsUrl.toString(), {
          method: 'GET',
          headers: { 'X-Mc-Auth': userToken, Accept: 'application/json' },
        });
        if (settingsRes.ok) {
          const settings: any = await settingsRes.json();
          networks = extractConnectedNetworks(settings);
        }
      } catch { /* non-fatal */ }

      if (dryRun) {
        results.push({
          agent_id: cand.agent_id, agent_name: cand.agent_name, blog_id: blogIdNum,
          status: 'imported', reason: 'dry_run — not written', networks,
        });
        continue;
      }

      // Upsert (just in case race condition with another admin importer).
      const { error: insErr } = await adminClient
        .from('metricool_brands')
        .upsert({
          agent_id: cand.agent_id,
          blog_id: blogIdNum,
          user_id_metricool: Number(metricoolUserId),
          user_token: userToken,
          brand_label: blogIdLabels.get(blogIdNum) ?? null,
          connected_networks: networks,
          provisioning_method: 'admin_imported',
          last_sync_at: new Date().toISOString(),
          last_error: null,
        }, { onConflict: 'agent_id' });

      if (insErr) {
        results.push({
          agent_id: cand.agent_id, agent_name: cand.agent_name, blog_id: blogIdNum,
          status: 'failed', reason: `DB write failed: ${insErr.message}`, networks,
        });
      } else {
        results.push({
          agent_id: cand.agent_id, agent_name: cand.agent_name, blog_id: blogIdNum,
          status: 'imported', networks,
        });
      }
    }

    const summary = {
      totalCandidates: results.length,
      imported: results.filter((r) => r.status === 'imported').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
      failed: results.filter((r) => r.status === 'failed').length,
      dry_run: dryRun,
    };

    return jsonResponse(req, { ok: true, summary, results, accessible_blog_count: accessibleBlogIds.size });
  } catch (err) {
    console.error('[metricool-admin-bulk-connect] uncaught:', err);
    return jsonResponse(
      req,
      { ok: false, error: 'Bulk connect failed', detail: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
});
