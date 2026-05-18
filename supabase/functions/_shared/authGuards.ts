// _shared/authGuards.ts
//
// Reusable auth gates for edge functions. Two flavors:
//
//   1. requireCronAuth(req)         — for cron-triggered functions
//   2. requireAdminAuth(req, ...)   — for admin-only manual triggers
//
// Both return `null` on success, or a 401/403 Response that the caller
// should return as-is. Designed so the call site stays one line:
//
//     const denied = await requireAdminAuth(req, url, key);
//     if (denied) return denied;
//
// History (2026-05-18): the audit found 8 unauthenticated functions —
// 5 cron-driven email blasters + 3 admin manual triggers. Rather than
// scatter ad-hoc auth checks across all 8, centralized here so the
// next sensitive function can opt in with a single import.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

/**
 * Cron auth: lenient-fallback pattern.
 *
 * - If env var `CRON_SHARED_SECRET` is set, the request MUST carry a
 *   matching `X-Cron-Secret` header. This is the strong gate.
 * - If `CRON_SHARED_SECRET` is unset, fall back to the legacy
 *   `X-Cron-Job: true` header check. This is a no-op gate, but it
 *   matches what cron jobs already send today and lets us deploy
 *   the hardened functions BEFORE the env var is set (zero-downtime).
 *
 * Once you've (a) deployed all 5 cron functions, (b) updated the
 * `cron.job` commands via migration to include the X-Cron-Secret
 * header, and (c) set the env var in the Supabase dashboard — the
 * fallback path stops being reachable and the function is locked.
 *
 * Returns null when the request is authorized.
 */
export function requireCronAuth(req: Request): Response | null {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-job, x-cron-secret",
  };

  const expected = Deno.env.get("CRON_SHARED_SECRET");

  if (expected && expected.length > 0) {
    const provided = req.headers.get("x-cron-secret") ?? req.headers.get("X-Cron-Secret");
    if (provided !== expected) {
      return new Response(
        JSON.stringify({ success: false, error: "Forbidden: invalid or missing cron secret" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    return null;
  }

  // Fallback: legacy X-Cron-Job header check (zero-trust no-op, but
  // matches what pg_cron sends today). Service-role JWT also accepted
  // for the brief deploy window before the env var lands.
  const isCron = req.headers.get("x-cron-job") === "true" || req.headers.get("X-Cron-Job") === "true";
  const authHeader = req.headers.get("Authorization") ?? "";
  const hasServiceRoleJwt = authHeader.startsWith("Bearer ");
  if (!isCron && !hasServiceRoleJwt) {
    return new Response(
      JSON.stringify({ success: false, error: "Forbidden: cron-only endpoint" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  return null;
}

/**
 * Admin auth: validate the JWT, look up the caller's role via
 * `get_current_user_role()`, and reject anything that isn't `admin`.
 *
 * The function must be deployed with `verify_jwt: true` so the
 * platform rejects unauthenticated calls before we even get here —
 * but we re-validate explicitly because we need the role lookup
 * anyway, and belt + suspenders is cheap.
 *
 * `editorAllowed` defaults to false. Pass true if the function is
 * safe for editors too (e.g. read-only profile views). Email-blast
 * triggers should keep the default.
 */
export async function requireAdminAuth(
  req: Request,
  supabaseUrl: string,
  supabaseServiceRoleKey: string,
  opts: { editorAllowed?: boolean } = {},
): Promise<{ denied: Response; user: null; role: null } | { denied: null; user: { id: string; email: string | null }; role: string }> {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      denied: new Response(
        JSON.stringify({ success: false, error: "Auth required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      ),
      user: null,
      role: null,
    };
  }

  const userClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userRes, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userRes?.user) {
    return {
      denied: new Response(
        JSON.stringify({ success: false, error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      ),
      user: null,
      role: null,
    };
  }

  const { data: role } = await userClient.rpc("get_current_user_role");
  const roleStr = typeof role === "string" ? role : "";
  const allowed = roleStr === "admin" || (opts.editorAllowed === true && roleStr === "editor");
  if (!allowed) {
    return {
      denied: new Response(
        JSON.stringify({ success: false, error: "Forbidden: admin only" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      ),
      user: null,
      role: null,
    };
  }

  return {
    denied: null,
    user: { id: userRes.user.id, email: userRes.user.email ?? null },
    role: roleStr,
  };
}
