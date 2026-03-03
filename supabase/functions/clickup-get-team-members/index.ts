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
    if (!clickupApiToken) {
      return new Response(
        JSON.stringify({ error: "CLICKUP_API_TOKEN not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch ClickUp teams
    console.log("Fetching ClickUp teams...");
    const teamsResponse = await fetch("https://api.clickup.com/api/v2/team", {
      headers: { Authorization: clickupApiToken, "Content-Type": "application/json" },
    });

    if (!teamsResponse.ok) {
      const errorText = await teamsResponse.text();
      console.error("Failed to fetch teams:", teamsResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: "Failed to fetch ClickUp teams", details: errorText }),
        { status: teamsResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const teamsData = await teamsResponse.json();
    console.log("Teams found:", teamsData.teams?.length || 0);

    const allMembers: Array<{
      id: number;
      username: string;
      email: string;
      color: string;
      team_id: string;
      team_name: string;
    }> = [];

    for (const team of teamsData.teams || []) {
      for (const member of team.members || []) {
        allMembers.push({
          id: member.user.id,
          username: member.user.username,
          email: member.user.email,
          color: member.user.color,
          team_id: team.id,
          team_name: team.name,
        });
      }
    }

    const uniqueMembers = Array.from(
      new Map(allMembers.map((m) => [m.id, m])).values()
    );

    return new Response(
      JSON.stringify({
        success: true,
        teams: teamsData.teams?.map((t: any) => ({ id: t.id, name: t.name })) || [],
        members: uniqueMembers,
        total_members: uniqueMembers.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error fetching ClickUp team members:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", message: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
