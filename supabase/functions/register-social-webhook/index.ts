// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const CLICKUP_API_TOKEN = Deno.env.get("CLICKUP_API_TOKEN");

  if (!CLICKUP_API_TOKEN) {
    return new Response(JSON.stringify({ error: "Missing CLICKUP_API_TOKEN" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    const { team_id, type } = await req.json();

    if (!team_id) {
      return new Response(JSON.stringify({ error: "team_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine which webhook(s) to register
    // type: "schedule" | "generate" | undefined (both)
    const registrations: Array<{ endpoint: string; events: string[]; label: string }> = [];

    if (!type || type === "schedule") {
      registrations.push({
        endpoint: `${SUPABASE_URL}/functions/v1/clickup-social-ready-to-schedule`,
        events: ["taskStatusUpdated"],
        label: "social-scheduling",
      });
    }

    if (!type || type === "generate") {
      registrations.push({
        endpoint: `${SUPABASE_URL}/functions/v1/clickup-generate-copy-webhook`,
        events: ["taskUpdated"],
        label: "social-generate-copy",
      });
    }

    const results: any[] = [];

    for (const reg of registrations) {
      const resp = await fetch(`https://api.clickup.com/api/v2/team/${team_id}/webhook`, {
        method: "POST",
        headers: {
          Authorization: CLICKUP_API_TOKEN,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          endpoint: reg.endpoint,
          events: reg.events,
        }),
      });

      const body = await resp.json();

      if (!resp.ok) {
        throw new Error(`ClickUp webhook registration failed for ${reg.label} [${resp.status}]: ${JSON.stringify(body)}`);
      }

      const webhookId = body?.id || body?.webhook?.id;

      // Save webhook registration record
      await supabase.from("clickup_webhooks").insert({
        webhook_id: webhookId,
        list_id: reg.label,
        team_id,
        active: true,
      });

      console.log(`Webhook registered (${reg.label}):`, { webhookId, team_id, endpoint: reg.endpoint });

      results.push({
        webhook_id: webhookId,
        endpoint: reg.endpoint,
        events: reg.events,
        label: reg.label,
      });
    }

    return new Response(
      JSON.stringify({ ok: true, webhooks: results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("register-social-webhook error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
