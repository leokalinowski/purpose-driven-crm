import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const CLICKUP_API_TOKEN = Deno.env.get("CLICKUP_API_TOKEN");

    if (!CLICKUP_API_TOKEN) {
      throw new Error("Missing CLICKUP_API_TOKEN");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const EVENTS_SPACE_ID = "90114016189";

    // 1. Fetch all folders from the Events space
    const foldersResp = await fetch(
      `https://api.clickup.com/api/v2/space/${EVENTS_SPACE_ID}/folder`,
      { headers: { Authorization: CLICKUP_API_TOKEN } }
    );

    if (!foldersResp.ok) {
      const text = await foldersResp.text();
      throw new Error(`ClickUp folders API error ${foldersResp.status}: ${text}`);
    }

    const foldersData = await foldersResp.json();
    const folders = foldersData.folders || [];
    console.log(`Found ${folders.length} folders in Events space`);

    // 2. Fetch all Hub events with their agent profiles
    const { data: events, error: eventsErr } = await supabase
      .from("events")
      .select("id, title, agent_id, event_date");

    if (eventsErr) throw eventsErr;

    // 3. Fetch all profiles to resolve agent names
    const { data: profiles, error: profilesErr } = await supabase
      .from("profiles")
      .select("user_id, full_name, email");

    if (profilesErr) throw profilesErr;

    const profilesByUserId: Record<string, { full_name: string; email: string }> = {};
    (profiles || []).forEach((p: any) => {
      if (p.user_id) {
        profilesByUserId[p.user_id] = {
          full_name: p.full_name || "",
          email: p.email || "",
        };
      }
    });

    // Parse folder name: "Samir [03.14.26] The Real Estate Scholarship"
    // or "Rashida [03.21.26] - The Real Estate Scholarship"
    const parseFolderName = (name: string) => {
      const match = name.match(/^(\w+)\s+\[[\d.]+\]\s*-?\s*(.+)$/);
      if (!match) return null;
      return {
        agentFirstName: match[1].trim().toLowerCase(),
        eventTitle: match[2].trim().toLowerCase(),
      };
    };

    // Classify lists inside a folder
    const classifyLists = (lists: any[]) => {
      let preEventId: string | null = null;
      let eventDayId: string | null = null;
      let postEventId: string | null = null;

      for (const list of lists) {
        const name = (list.name || "").toLowerCase();
        if (name.includes("pre")) {
          preEventId = list.id;
        } else if (name.includes("day")) {
          eventDayId = list.id;
        } else if (name.includes("post")) {
          postEventId = list.id;
        }
      }
      return { preEventId, eventDayId, postEventId };
    };

    const linked: Array<{ folder: string; event: string; eventId: string }> = [];
    const unmatched: Array<{ folder: string; reason: string }> = [];
    const alreadyLinked: Array<{ folder: string; event: string }> = [];

    for (const folder of folders) {
      const parsed = parseFolderName(folder.name);
      if (!parsed) {
        unmatched.push({ folder: folder.name, reason: "Could not parse folder name" });
        continue;
      }

      // Find matching Hub event
      const matchedEvent = (events || []).find((ev: any) => {
        const titleMatch = ev.title.toLowerCase().includes(parsed.eventTitle) ||
          parsed.eventTitle.includes(ev.title.toLowerCase());

        if (!titleMatch) return false;

        // Check agent first name
        if (ev.agent_id && profilesByUserId[ev.agent_id]) {
          const fullName = profilesByUserId[ev.agent_id].full_name.toLowerCase();
          const firstName = fullName.split(" ")[0];
          return firstName === parsed.agentFirstName;
        }

        return false;
      });

      if (!matchedEvent) {
        unmatched.push({
          folder: folder.name,
          reason: `No Hub event matched (agent: "${parsed.agentFirstName}", title: "${parsed.eventTitle}")`,
        });
        continue;
      }

      // Check if already linked
      if ((matchedEvent as any).clickup_folder_id === folder.id) {
        alreadyLinked.push({ folder: folder.name, event: matchedEvent.title });
        continue;
      }

      // Get lists inside this folder
      const lists = folder.lists || [];
      const classified = classifyLists(lists);

      // Update the event with folder + list IDs
      const { error: updateErr } = await supabase
        .from("events")
        .update({
          clickup_folder_id: folder.id,
          clickup_pre_event_list_id: classified.preEventId,
          clickup_event_day_list_id: classified.eventDayId,
          clickup_post_event_list_id: classified.postEventId,
          // Also set the legacy field to the pre-event list as default
          clickup_list_id: classified.preEventId || classified.eventDayId || classified.postEventId,
        })
        .eq("id", matchedEvent.id);

      if (updateErr) {
        unmatched.push({ folder: folder.name, reason: `DB update error: ${updateErr.message}` });
        continue;
      }

      linked.push({
        folder: folder.name,
        event: matchedEvent.title,
        eventId: matchedEvent.id,
      });
    }

    return new Response(
      JSON.stringify({
        message: `Linked ${linked.length} events, ${unmatched.length} unmatched, ${alreadyLinked.length} already linked`,
        linked,
        unmatched,
        alreadyLinked,
        totalFolders: folders.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Link events error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
