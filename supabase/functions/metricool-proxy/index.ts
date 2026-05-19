/**
 * metricool-proxy — server-side authenticated proxy to the Metricool REST API.
 *
 * Why a proxy:
 *   - Keeps the Metricool userToken (X-Mc-Auth) on the server. Never goes
 *     to the browser.
 *   - Auto-injects the agent's blogId + userId so the React UI doesn't have
 *     to know either.
 *   - Single chokepoint for rate limiting, retry/backoff, and error
 *     normalization (Metricool publishes no rate-limit numbers).
 *
 * Request body (POST):
 *   {
 *     "method":  "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
 *     "path":    "/v2/scheduler/posts" | "/v2/analytics/aggregation" | ...,
 *     "query":   { "start": "2026-05-01" },     // optional
 *     "body":    { ... },                       // optional, JSON-serialized
 *     "skipAuthInject": false                   // optional, for endpoints that don't take userId/blogId
 *   }
 *
 * Response (always 200; real status is in the body):
 *   { ok: true,  status, data }
 *   { ok: false, status, error, detail? }
 *
 * Auth model:
 *   - Caller is an authenticated REOP user (we read their JWT).
 *   - We load their row from metricool_brands. If missing → ok:false NOT_CONNECTED.
 *   - Master agency credentials (env METRICOOL_AGENCY_USER_TOKEN +
 *     METRICOOL_AGENCY_USER_ID) take precedence when the row's
 *     provisioning_method = 'agency'. Otherwise the per-agent BYO
 *     user_token is used.
 *
 * Allowlist:
 *   We only proxy paths starting with /v2/, /admin/, or /actions/.
 *
 * NOTE: this replaces an unused iframe-stripping CORS proxy that lived at
 * the same slug. No frontend code referenced the old proxy.
 */

import { buildCorsHeaders } from '../_shared/cors.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const METRICOOL_BASE_URL = 'https://app.metricool.com/api';
const ALLOWED_PATH_PREFIXES = ['/v2/', '/admin/', '/actions/'];

interface ProxyRequest {
  method?: string;
  path?: string;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  rawBody?: string;
  skipAuthInject?: boolean;
}

function jsonResponse(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' },
  });
}

function isAllowedPath(path: string): boolean {
  return ALLOWED_PATH_PREFIXES.some((p) => path.startsWith(p));
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: buildCorsHeaders(req) });
  }
  if (req.method !== 'POST') {
    return jsonResponse(req, { ok: false, error: 'Method not allowed' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // --- Auth: verify caller is an authenticated REOP user --------------
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
    const callerId = userData.user.id;

    // --- Load brand row -------------------------------------------------
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: brand, error: brandErr } = await adminClient
      .from('metricool_brands')
      .select('blog_id, user_id_metricool, user_token, provisioning_method')
      .eq('agent_id', callerId)
      .maybeSingle();

    if (brandErr) {
      return jsonResponse(req, { ok: false, error: 'Brand lookup failed', detail: brandErr.message }, 500);
    }
    if (!brand) {
      return jsonResponse(
        req,
        {
          ok: false,
          status: 412,
          error: 'NOT_CONNECTED',
          detail: 'Connect Metricool first via Social → Connect tab.',
        },
        200,
      );
    }

    // Master agency credentials override per-agent token if provisioning_method = 'agency'.
    const agencyUserToken = Deno.env.get('METRICOOL_AGENCY_USER_TOKEN');
    const agencyUserId = Deno.env.get('METRICOOL_AGENCY_USER_ID');
    const useAgency = brand.provisioning_method === 'agency' && agencyUserToken && agencyUserId;

    const userToken = useAgency ? agencyUserToken! : brand.user_token;
    const metricoolUserId = useAgency ? agencyUserId! : (brand.user_id_metricool?.toString() ?? '');
    const blogId = brand.blog_id.toString();

    // --- Parse the proxy request ---------------------------------------
    let proxyReq: ProxyRequest;
    try {
      proxyReq = await req.json();
    } catch {
      return jsonResponse(req, { ok: false, error: 'Invalid JSON body' }, 400);
    }

    const method = (proxyReq.method ?? 'GET').toUpperCase();
    const path = proxyReq.path ?? '';
    if (!path.startsWith('/')) {
      return jsonResponse(req, { ok: false, error: 'path must start with /' }, 400);
    }
    if (!isAllowedPath(path)) {
      return jsonResponse(
        req,
        { ok: false, error: `Disallowed path. Must start with one of: ${ALLOWED_PATH_PREFIXES.join(', ')}` },
        400,
      );
    }

    // --- Build upstream URL --------------------------------------------
    const url = new URL(`${METRICOOL_BASE_URL}${path}`);
    if (!proxyReq.skipAuthInject) {
      if (metricoolUserId) url.searchParams.set('userId', metricoolUserId);
      if (blogId) url.searchParams.set('blogId', blogId);
    }
    if (proxyReq.query) {
      for (const [k, v] of Object.entries(proxyReq.query)) {
        if (v != null) url.searchParams.set(k, String(v));
      }
    }

    // --- Body ---------------------------------------------------------
    let upstreamBody: BodyInit | undefined;
    const upstreamHeaders: Record<string, string> = {
      'X-Mc-Auth': userToken,
      Accept: 'application/json',
    };
    if (method !== 'GET' && method !== 'HEAD') {
      if (proxyReq.rawBody != null) {
        upstreamBody = proxyReq.rawBody;
      } else if (proxyReq.body !== undefined) {
        upstreamBody = JSON.stringify(proxyReq.body);
        upstreamHeaders['Content-Type'] = 'application/json';
      }
    }

    // --- Fetch with one retry on 5xx / network --------------------------
    const fetchOnce = () =>
      fetch(url.toString(), { method, headers: upstreamHeaders, body: upstreamBody });

    let upstream: Response;
    try {
      upstream = await fetchOnce();
      if (upstream.status >= 500 && upstream.status < 600) {
        await new Promise((r) => setTimeout(r, 600));
        upstream = await fetchOnce();
      }
    } catch (networkErr) {
      try {
        await new Promise((r) => setTimeout(r, 600));
        upstream = await fetchOnce();
      } catch (err2) {
        return jsonResponse(
          req,
          { ok: false, error: 'Metricool unreachable', detail: err2 instanceof Error ? err2.message : String(err2) },
          200,
        );
      }
    }

    // --- Parse response ------------------------------------------------
    const contentType = upstream.headers.get('content-type') ?? '';
    const text = await upstream.text();
    let data: unknown = text;
    if (contentType.includes('application/json') && text.length > 0) {
      try {
        data = JSON.parse(text);
      } catch {
        // keep as text on parse failure
      }
    }

    // Persist last_error for surface in UI (fire-and-forget).
    if (!upstream.ok) {
      const errStr = typeof data === 'string'
        ? data.slice(0, 200)
        : JSON.stringify(data).slice(0, 200);
      adminClient
        .from('metricool_brands')
        .update({ last_error: `${upstream.status} ${path}: ${errStr}` })
        .eq('agent_id', callerId)
        .then(() => {})
        .catch(() => {});
    }

    const errorMessage = upstream.ok
      ? undefined
      : typeof data === 'string'
        ? data
        : ((data as { error?: string; message?: string })?.error
          ?? (data as { error?: string; message?: string })?.message
          ?? `Upstream ${upstream.status}`);

    return jsonResponse(
      req,
      {
        ok: upstream.ok,
        status: upstream.status,
        data: upstream.ok ? data : undefined,
        error: errorMessage,
        detail: upstream.ok ? undefined : data,
      },
      // Always 200 — real status is in the body. supabase-js auto-throws on
      // non-2xx, which would mask Metricool's actual error structure.
      200,
    );
  } catch (err) {
    console.error('[metricool-proxy] uncaught:', err);
    return jsonResponse(
      req,
      { ok: false, error: 'Proxy failure', detail: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
});
