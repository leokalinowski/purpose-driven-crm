import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CLICKUP_BASE = "https://api.clickup.com/api/v2";
const TEAM_ID = "9011620633";
const SPACE_ID = "90114016189";

async function clickupFetch(
  path: string,
  token: string,
  options?: RequestInit
) {
  const resp = await fetch(`${CLICKUP_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });
  const body = await resp.json();
  if (!resp.ok) {
    console.error("ClickUp API error:", resp.status, JSON.stringify(body));
    throw new Error(
      `ClickUp API ${resp.status}: ${body.err || body.error || JSON.stringify(body)}`
    );
  }
  return body;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const CLICKUP_API_TOKEN = Deno.env.get("CLICKUP_API_TOKEN");

    if (!CLICKUP_API_TOKEN) throw new Error("Missing CLICKUP_API_TOKEN");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { eventId, agentId, eventTitle, eventDate } = await req.json();

    if (!eventId || !agentId || !eventTitle || !eventDate) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: eventId, agentId, eventTitle, eventDate" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Look up the agent's first name
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("user_id", agentId)
      .single();

    const agentFirstName = profile?.first_name || "Agent";

    // 2. Format folder name: AgentFirstName [MM.DD.YY] Event Title
    const d = new Date(eventDate);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const yy = String(d.getFullYear()).slice(-2);
    const folderName = `${agentFirstName} [${mm}.${dd}.${yy}] ${eventTitle}`;

    console.log(`Creating ClickUp folder: "${folderName}" for event ${eventId}`);

    // 3. Try to find a folder template
    let folderId: string | null = null;

    try {
      const templates = await clickupFetch(
        `/team/${TEAM_ID}/folder_template`,
        CLICKUP_API_TOKEN
      );
      console.log("Available folder templates:", JSON.stringify(templates));

      const eventTemplate = (templates.templates || templates.folder_templates || []).find(
        (t: any) => t.name?.toLowerCase().includes("event")
      );

      if (eventTemplate) {
        console.log(`Found template: "${eventTemplate.name}" (${eventTemplate.id})`);
        const created = await clickupFetch(
          `/space/${SPACE_ID}/folder_template/${eventTemplate.id}`,
          CLICKUP_API_TOKEN,
          { method: "POST", body: JSON.stringify({ name: folderName }) }
        );
        folderId = created.id || created.folder?.id;
        console.log("Folder created from template, ID:", folderId);
      }
    } catch (err: any) {
      console.warn("Template lookup/creation failed, falling back to manual:", err.message);
    }

    // 4. Fallback: create folder manually
    if (!folderId) {
      console.log("Creating folder manually (no template)");
      const created = await clickupFetch(
        `/space/${SPACE_ID}/folder`,
        CLICKUP_API_TOKEN,
        { method: "POST", body: JSON.stringify({ name: folderName }) }
      );
      folderId = created.id;
      console.log("Manual folder created, ID:", folderId);

      // Create 3 lists
      for (const listName of ["Pre-Event", "Event Day", "Post-Event"]) {
        await clickupFetch(`/folder/${folderId}/list`, CLICKUP_API_TOKEN, {
          method: "POST",
          body: JSON.stringify({ name: listName }),
        });
        console.log(`Created list: ${listName}`);
      }
    }

    // 5. Retrieve lists from the new folder
    const listsResp = await clickupFetch(
      `/folder/${folderId}/list`,
      CLICKUP_API_TOKEN
    );
    const lists: any[] = listsResp.lists || [];
    console.log("Lists in folder:", lists.map((l: any) => `${l.name} (${l.id})`));

    // 6. Classify lists by name
    let preEventListId: string | null = null;
    let eventDayListId: string | null = null;
    let postEventListId: string | null = null;

    for (const list of lists) {
      const name = (list.name || "").toLowerCase();
      if (name.includes("pre")) {
        preEventListId = list.id;
      } else if (name.includes("post")) {
        postEventListId = list.id;
      } else if (name.includes("day") || name.includes("event day")) {
        eventDayListId = list.id;
      }
    }

    // If we have exactly 3 lists but couldn't classify, assign in order
    if (lists.length >= 3 && (!preEventListId || !eventDayListId || !postEventListId)) {
      if (!preEventListId) preEventListId = lists[0]?.id;
      if (!eventDayListId) eventDayListId = lists[1]?.id;
      if (!postEventListId) postEventListId = lists[2]?.id;
    }

    console.log("Classified lists:", { preEventListId, eventDayListId, postEventListId });

    // 7. Update the Hub event record
    const { error: updateErr } = await supabase
      .from("events")
      .update({
        clickup_folder_id: folderId,
        clickup_pre_event_list_id: preEventListId,
        clickup_event_day_list_id: eventDayListId,
        clickup_post_event_list_id: postEventListId,
      })
      .eq("id", eventId);

    if (updateErr) {
      console.error("Failed to update event with ClickUp IDs:", updateErr);
      throw new Error(`DB update failed: ${updateErr.message}`);
    }

    const result = {
      success: true,
      folderId,
      folderName,
      lists: { preEventListId, eventDayListId, postEventListId },
    };

    console.log("Success:", JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("clickup-create-event-folder error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
