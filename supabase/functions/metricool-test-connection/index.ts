/**
 * metricool-test-connection — validates BYO Metricool credentials before we
 * persist them. Called from the Connect tab when the agent pastes their
 * userToken + userId + blogId.
 *
 * Flow:
 *   1. Caller is an authenticated REOP user.
 *   2. Body has { user_token, user_id_metricool, blog_id }.
 *   3. We call GET /admin/simpleProfiles with those creds.
 *   4. If we get back the agent's brand list AND blog_id is one of them,
 *      we return success + the matched brand label + connected networks.
 *   5. Caller saves to metricool_brands via supabase from the React layer.
 *
 * Returns:
 *   { ok: true,  brand_label, connected_networks }
 *   { ok: false, error }
 */

import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const METRICOOL_BASE_URL = 'https://app.metricool.com/api';

interface TestRequest {
  user_token?: string;
  user_id_metricool?: number | string;
  blog_id?: number | string;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verify caller authenticated
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.toLowerCase().startsWith('bearer ')) {
      return jsonResponse({ ok: false, error: 'Missing bearer token' }, 401);
    }
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return jsonResponse({ ok: false, error: 'Unauthorized' }, 401);
    }

    let body: TestRequest;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ ok: false, error: 'Invalid JSON body' }, 400);
    }

    const userToken = (body.user_token ?? '').trim();
    const metricoolUserId = String(body.user_id_metricool ?? '').trim();
    const blogId = String(body.blog_id ?? '').trim();

    if (!userToken || !metricoolUserId || !blogId) {
      return jsonResponse(
        { ok: false, error: 'user_token, user_id_metricool, and blog_id are all required' },
        400,
      );
    }
    if (!/^\d+$/.test(metricoolUserId) || !/^\d+$/.test(blogId)) {
      return jsonResponse(
        { ok: false, error: 'user_id_metricool and blog_id must be integers' },
        400,
      );
    }

    // Step 1: list brands to verify the credentials work AND blog_id matches.
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
        { ok: false, error: 'Could not reach Metricool', detail: err instanceof Error ? err.message : String(err) },
        200,
      );
    }

    if (profilesRes.status === 401 || profilesRes.status === 403) {
      return jsonResponse(
        {
          ok: false,
          error: 'Invalid credentials. Double-check the User Token and User ID at app.metricool.com → user settings.',
        },
        200,
      );
    }
    if (!profilesRes.ok) {
      const text = await profilesRes.text();
      return jsonResponse(
        { ok: false, error: `Metricool returned ${profilesRes.status}`, detail: text.slice(0, 500) },
        200,
      );
    }

    let profiles: unknown;
    try {
      profiles = await profilesRes.json();
    } catch {
      return jsonResponse({ ok: false, error: 'Metricool response was not JSON' }, 200);
    }

    // Metricool returns an array of brand objects with at least { id, label } — sometimes blogId.
    // We accept either id or blogId as the matching key.
    const profileList = Array.isArray(profiles)
      ? profiles
      : Array.isArray((profiles as { brands?: unknown[] })?.brands)
        ? (profiles as { brands: unknown[] }).brands
        : [];

    const blogIdNum = Number(blogId);
    const match = profileList.find((b: any) => {
      const candidates = [b?.id, b?.blogId, b?.blog_id, b?.profileId];
      return candidates.some((c) => c != null && Number(c) === blogIdNum);
    }) as { label?: string; id?: number; blogId?: number } | undefined;

    if (!match) {
      return jsonResponse(
        {
          ok: false,
          error: `blog_id ${blogId} is not under this account. Available brands: ${profileList
            .slice(0, 5)
            .map((b: any) => `${b?.id ?? b?.blogId ?? '?'} (${b?.label ?? 'unnamed'})`)
            .join(', ')}`,
        },
        200,
      );
    }

    // Step 2 (best-effort): fetch the brand's connected-networks state so we
    // can show the agent which platforms are already linked. /v2/settings/brands
    // returns rich data; failure here is non-fatal.
    const networks: string[] = [];
    try {
      const settingsUrl = new URL(`${METRICOOL_BASE_URL}/v2/settings/brands`);
      settingsUrl.searchParams.set('userId', metricoolUserId);
      settingsUrl.searchParams.set('blogId', blogId);
      const settingsRes = await fetch(settingsUrl.toString(), {
        method: 'GET',
        headers: { 'X-Mc-Auth': userToken, Accept: 'application/json' },
      });
      if (settingsRes.ok) {
        const settings: any = await settingsRes.json();
        const conns = settings?.connections ?? settings?.networks ?? settings;
        if (conns && typeof conns === 'object') {
          for (const [key, val] of Object.entries(conns)) {
            // A network is "connected" if its block has a non-empty token / id / handle.
            if (val && typeof val === 'object') {
              const v = val as Record<string, unknown>;
              if (v.token || v.id || v.handle || v.username || v.connected === true) {
                networks.push(key);
              }
            } else if (typeof val === 'string' && val.length > 0) {
              networks.push(key);
            }
          }
        }
      }
    } catch {
      // non-fatal — UI just won't show the network pills on first save.
    }

    return jsonResponse({
      ok: true,
      brand_label: match.label ?? `Brand ${blogId}`,
      blog_id: blogIdNum,
      user_id_metricool: Number(metricoolUserId),
      connected_networks: networks,
    });
  } catch (err) {
    console.error('[metricool-test-connection] uncaught:', err);
    return jsonResponse(
      { ok: false, error: 'Test failed', detail: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
});
