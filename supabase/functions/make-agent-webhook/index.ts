import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type JsonRecord = Record<string, unknown>;

serve(async (req) => {
  // Handle CORS preflight requests
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

    const body = (await req.json().catch(() => ({}))) as JsonRecord;
    const agentUserId = (body.agentUserId as string | undefined)?.trim();
    if (!agentUserId) {
      return new Response(JSON.stringify({ success: false, error: "agentUserId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const makePayload = {
      submitted_at: new Date().toISOString(),
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