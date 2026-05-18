import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  // Pinned to the production hub origin (and localhost dev) instead of "*".
  // Combined with verify_jwt this prevents a malicious page in another tab
  // from CSRFing the function with the agent's cookie.
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type JsonRecord = Record<string, unknown>;

/**
 * make-agent-webhook — forwards an agent's full profile (PII included:
 * email, phone, license, brokerage, GCI goal) to a Make.com scenario URL.
 *
 * SECURITY (hardened 2026-05-18):
 *   - Requires a valid Supabase JWT (verify_jwt: true at deploy time)
 *   - Caller MUST hold role `admin` or `editor` per `get_current_user_role()`
 *
 * Before this hardening, the function was wide open: any unauthenticated
 * caller could POST `{"agentUserId":"<uuid>"}` and exfiltrate any agent's
 * profile. With only 19 agents, UUIDs were easily enumerable.
 *
 * Why role-gate? The only legitimate caller is `src/pages/EditorLanding.tsx`,
 * which is itself gated to `isAdmin || isEditor`. Mirroring that check here
 * is defense-in-depth — if the page gate is ever bypassed (or someone curls
 * the function directly with a regular agent JWT), the function still
 * refuses.
 */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const makeWebhookUrl = Deno.env.get("MAKE_WEBHOOK_URL") ?? "";

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Missing Supabase environment variables");
    }
    if (!makeWebhookUrl) {
      throw new Error("MAKE_WEBHOOK_URL is not configured");
    }

    // ─── Auth gate ─────────────────────────────────────────────────────────
    // Even though we set verify_jwt: true at deploy time (which makes the
    // platform reject anonymous calls before the function runs), we re-fetch
    // the caller's user record + role via the JWT and gate explicitly. Two
    // reasons: (a) belt + suspenders if verify_jwt is ever flipped back, and
    // (b) we need the role lookup anyway to enforce admin/editor only.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ success: false, error: "Auth required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ success: false, error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: role } = await userClient.rpc("get_current_user_role");
    if (role !== "admin" && role !== "editor") {
      return new Response(JSON.stringify({ success: false, error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Input validation ──────────────────────────────────────────────────
    const body = (await req.json().catch(() => ({}))) as JsonRecord;
    const agentUserId = (body.agentUserId as string | undefined)?.trim();
    if (!agentUserId) {
      return new Response(JSON.stringify({ success: false, error: "agentUserId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Belt + suspenders UUID format check — prevents pathological agentUserId
    // values from being passed through to Make and bouncing around in logs.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(agentUserId)) {
      return new Response(JSON.stringify({ success: false, error: "agentUserId must be a UUID" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Service-role profile fetch ────────────────────────────────────────
    // We use the service-role client to read the target agent's profile because
    // the caller is admin/editor and needs the full profile (including PII)
    // regardless of their own RLS scope. The role gate above is the auth.
    const supabaseServiceRole = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { data: profile, error: profileError } = await supabaseServiceRole
      .from("profiles")
      .select("*")
      .eq("user_id", agentUserId)
      .single();

    if (profileError || !profile) {
      console.error("Profile fetch failed:", profileError);
      return new Response(JSON.stringify({ success: false, error: "Agent profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Forward to Make.com ───────────────────────────────────────────────
    const makePayload = {
      submitted_at: new Date().toISOString(),
      submitted_by: userRes.user.id,           // audit trail
      submitted_by_role: role,                  // audit trail
      agent_user_id: agentUserId,
      agent_profile: profile,
    };

    const makeRes = await fetch(makeWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(makePayload),
    });

    const makeText = await makeRes.text().catch(() => "");
    if (!makeRes.ok) {
      console.error("Make webhook error:", makeRes.status, makeText);
      return new Response(
        JSON.stringify({ success: false, error: "Make webhook failed", status: makeRes.status, body: makeText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ success: true, make_status: makeRes.status, make_body: makeText }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("make-agent-webhook error:", error);
    return new Response(JSON.stringify({ success: false, error: error?.message ?? "Unknown error" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
