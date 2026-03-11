import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth guard: require admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      console.error("clickup-get-list-fields: getClaims failed:", claimsError?.message);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: userRole, error: roleError } = await supabaseAuth.rpc("get_current_user_role");
    if (roleError || userRole !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden: Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clickupApiToken = Deno.env.get("CLICKUP_API_TOKEN");
    const listId = Deno.env.get("CLICKUP_SUPPORT_LIST_ID") || "901113093436";

    if (!clickupApiToken) {
      return new Response(
        JSON.stringify({ error: "CLICKUP_API_TOKEN not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const headers = { Authorization: clickupApiToken, "Content-Type": "application/json" };

    console.log(`Fetching list details for ${listId}...`);
    const listResponse = await fetch(`https://api.clickup.com/api/v2/list/${listId}`, { headers });

    if (!listResponse.ok) {
      const errorText = await listResponse.text();
      console.error("Failed to fetch list:", listResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: "Failed to fetch list", details: errorText }),
        { status: listResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const listData = await listResponse.json();

    console.log(`Fetching custom fields for list ${listId}...`);
    const fieldsResponse = await fetch(`https://api.clickup.com/api/v2/list/${listId}/field`, { headers });

    let customFields = [];
    if (fieldsResponse.ok) {
      const fieldsData = await fieldsResponse.json();
      customFields = fieldsData.fields || [];
    }

    const statuses = listData.statuses || [];

    return new Response(
      JSON.stringify({
        success: true,
        list: {
          id: listData.id,
          name: listData.name,
          space: listData.space,
          folder: listData.folder,
        },
        statuses: statuses.map((s: any) => ({
          id: s.id,
          status: s.status,
          color: s.color,
          type: s.type,
        })),
        custom_fields: customFields.map((f: any) => ({
          id: f.id,
          name: f.name,
          type: f.type,
          type_config: f.type_config,
          required: f.required,
        })),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error fetching list fields:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", message: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
