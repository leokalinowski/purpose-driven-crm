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

    // Get all events — prefer the 3-list columns, fall back to clickup_list_id
    const { data: events, error: eventsErr } = await supabase
      .from("events")
      .select("id, agent_id, clickup_list_id, clickup_pre_event_list_id, clickup_event_day_list_id, clickup_post_event_list_id");

    if (eventsErr) throw eventsErr;

    // Filter to events that have at least one list ID
    const eventsWithLists = (events || []).filter((e: any) =>
      e.clickup_pre_event_list_id || e.clickup_event_day_list_id || e.clickup_post_event_list_id || e.clickup_list_id
    );

    if (eventsWithLists.length === 0) {
      return new Response(JSON.stringify({ message: "No events with ClickUp lists found", synced: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // No need for profiles lookup — agent_id always comes from the event

    let totalSynced = 0;
    const errors: string[] = [];

    const fetchAndSyncList = async (
      listId: string,
      eventId: string,
      eventAgentId: string | null,
      phase: string
    ) => {
      const resp = await fetch(
        `https://api.clickup.com/api/v2/list/${listId}/task?include_closed=true&subtasks=true`,
        { headers: { Authorization: CLICKUP_API_TOKEN!, "Content-Type": "application/json" } }
      );

      if (!resp.ok) {
        errors.push(`List ${listId}: HTTP ${resp.status}`);
        return 0;
      }

      const data = await resp.json();
      const clickupTasks = data.tasks || [];
      let synced = 0;

      for (const task of clickupTasks) {

        // Parse dates
        let dueDate: string | null = null;
        if (task.due_date) {
          try {
            const ms = typeof task.due_date === "string" ? parseInt(task.due_date) : task.due_date;
            const d = new Date(isNaN(ms) ? task.due_date : ms);
            if (!isNaN(d.getTime())) dueDate = d.toISOString().slice(0, 10);
          } catch (_) {}
        }

        let completedAt: string | null = null;
        const completedRaw = task.date_done || task.completed_at;
        if (completedRaw) {
          try {
            const ms = typeof completedRaw === "string" ? parseInt(completedRaw) : completedRaw;
            const d = new Date(isNaN(ms) ? completedRaw : ms);
            if (!isNaN(d.getTime())) completedAt = d.toISOString();
          } catch (_) {}
        }

        const status = task.status?.status || task.status || null;
        const doneKeywords = ["done", "closed", "complete", "completed"];
        const isCompleted = status ? doneKeywords.includes(String(status).toLowerCase()) : false;

        const responsible = Array.isArray(task.assignees)
          ? task.assignees.map((a: any) => a.username || a.email || a.id).join(", ")
          : "";

        const upsertPayload: Record<string, any> = {
          event_id: eventId,
          clickup_task_id: task.id,
          task_name: task.name || "Untitled",
          status: status,
          due_date: dueDate,
          responsible_person: responsible || null,
          completed_at: isCompleted ? completedAt || new Date().toISOString() : null,
          agent_id: eventAgentId || null,
          phase: phase,
          updated_at: new Date().toISOString(),
        };

        const { error: upsertErr } = await supabase
          .from("clickup_tasks")
          .upsert(upsertPayload, { onConflict: "clickup_task_id" });

        if (upsertErr) {
          errors.push(`Task ${task.id}: ${upsertErr.message}`);
        } else {
          synced++;
        }
      }

      return synced;
    };

    for (const event of eventsWithLists) {
      try {
        // Sync from the 3 phase-specific lists if available
        if (event.clickup_pre_event_list_id) {
          totalSynced += await fetchAndSyncList(event.clickup_pre_event_list_id, event.id, event.agent_id, "pre_event");
        }
        if (event.clickup_event_day_list_id) {
          totalSynced += await fetchAndSyncList(event.clickup_event_day_list_id, event.id, event.agent_id, "event_day");
        }
        if (event.clickup_post_event_list_id) {
          totalSynced += await fetchAndSyncList(event.clickup_post_event_list_id, event.id, event.agent_id, "post_event");
        }

        // Fallback: if no phase-specific lists, use the legacy clickup_list_id
        if (!event.clickup_pre_event_list_id && !event.clickup_event_day_list_id && !event.clickup_post_event_list_id && event.clickup_list_id) {
          totalSynced += await fetchAndSyncList(event.clickup_list_id, event.id, event.agent_id, "pre_event");
        }
      } catch (err: any) {
        errors.push(`Event ${event.id}: ${err.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        message: `Synced ${totalSynced} tasks across ${eventsWithLists.length} events`,
        synced: totalSynced,
        events: eventsWithLists.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Sync error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
