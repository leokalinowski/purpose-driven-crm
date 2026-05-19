// _shared/cors.ts
//
// Origin-aware CORS headers. Two exports:
//
//   buildCorsHeaders(req)  — the secure version. Echoes the request
//                            Origin if in the allowlist; otherwise
//                            sets ACAO to the production hub
//                            (browser rejects → cross-origin blocked).
//
//   corsHeaders            — DEPRECATED static wildcard. Kept as a
//                            backward-compat shim so existing edge
//                            functions don't break the moment this
//                            file lands. Migrate to buildCorsHeaders.
//
// USAGE (new code)
//   import { buildCorsHeaders } from '../_shared/cors.ts';
//   ...
//   if (req.method === 'OPTIONS') {
//     return new Response(null, { headers: buildCorsHeaders(req) });
//   }
//   return new Response(json, {
//     headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' },
//   });
//
// WHY
//   The wildcard ACAO let a malicious page in any tab read the
//   response of any edge function. For functions with verify_jwt:false
//   that return data, that's exfiltration. For JWT-protected ones
//   it's defense-in-depth.
//
// ALLOWLIST
//   - Production hub.
//   - localhost dev ports (5173 default, 5174 fallback per CLAUDE.md).
//   - Optional `ALLOWED_ORIGINS` env var (comma-separated) for
//     temporary additions without a code redeploy.

const HARDCODED_ORIGINS = [
  'https://hub.realestateonpurpose.com',
  'http://localhost:5173',
  'http://localhost:5174',
];

function isAllowed(origin: string | null): boolean {
  if (!origin) return false;
  if (HARDCODED_ORIGINS.includes(origin)) return true;
  const env = Deno.env.get('ALLOWED_ORIGINS') ?? '';
  if (!env) return false;
  return env.split(',').map(s => s.trim()).filter(Boolean).includes(origin);
}

/**
 * Build origin-aware CORS headers for the given request.
 * Allowlisted origin → echo it back + Vary: Origin.
 * Anything else → fall back to the prod hub (browser rejects).
 */
export function buildCorsHeaders(req: Request): Record<string, string> {
  const reqOrigin = req.headers.get('Origin');
  const allow = isAllowed(reqOrigin) ? reqOrigin! : HARDCODED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-cron-job, x-cron-secret',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Vary': 'Origin',
  };
}

/**
 * @deprecated wildcard CORS — kept for backward compatibility while
 * the 28 consumers of this module migrate to `buildCorsHeaders(req)`.
 * Do not use in new code. Will be removed in a follow-up PR once the
 * migration is complete.
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
