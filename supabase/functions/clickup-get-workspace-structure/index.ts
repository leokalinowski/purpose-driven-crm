import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";
import { corsHeaders } from "../_shared/cors.ts";

const TEAM_ID = "9011620633"; // Real Estate on Purpose

interface ClickUpList {
  id: string;
  name: string;
}

interface ClickUpFolder {
  id: string;
  name: string;
  lists: ClickUpList[];
}

interface ClickUpSpace {
  id: string;
  name: string;
  folders: ClickUpFolder[];
  folderlessLists: ClickUpList[];
}

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
      console.error("clickup-get-workspace-structure: getClaims failed:", claimsError?.message);
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

    const headers = { Authorization: clickupApiToken, "Content-Type": "application/json" };

    console.log(`Fetching spaces for team ${TEAM_ID}...`);
    const spacesResponse = await fetch(`https://api.clickup.com/api/v2/team/${TEAM_ID}/space`, { headers });

    if (!spacesResponse.ok) {
      const errorText = await spacesResponse.text();
      return new Response(
        JSON.stringify({ error: "Failed to fetch spaces", details: errorText }),
        { status: spacesResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const spacesData = await spacesResponse.json();
    const workspaceStructure: ClickUpSpace[] = [];

    for (const space of spacesData.spaces || []) {
      const spaceResult: ClickUpSpace = {
        id: space.id,
        name: space.name,
        folders: [],
        folderlessLists: [],
      };

      const foldersResponse = await fetch(`https://api.clickup.com/api/v2/space/${space.id}/folder`, { headers });
      if (foldersResponse.ok) {
        const foldersData = await foldersResponse.json();
        for (const folder of foldersData.folders || []) {
          const folderResult: ClickUpFolder = { id: folder.id, name: folder.name, lists: [] };
          const listsResponse = await fetch(`https://api.clickup.com/api/v2/folder/${folder.id}/list`, { headers });
          if (listsResponse.ok) {
            const listsData = await listsResponse.json();
            for (const list of listsData.lists || []) {
              folderResult.lists.push({ id: list.id, name: list.name });
            }
          }
          spaceResult.folders.push(folderResult);
        }
      }

      const folderlessResponse = await fetch(`https://api.clickup.com/api/v2/space/${space.id}/list`, { headers });
      if (folderlessResponse.ok) {
        const folderlessData = await folderlessResponse.json();
        for (const list of folderlessData.lists || []) {
          spaceResult.folderlessLists.push({ id: list.id, name: list.name });
        }
      }

      workspaceStructure.push(spaceResult);
    }

    return new Response(
      JSON.stringify({
        success: true,
        team_id: TEAM_ID,
        team_name: "Real Estate on Purpose",
        structure: workspaceStructure,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error fetching workspace structure:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", message: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
