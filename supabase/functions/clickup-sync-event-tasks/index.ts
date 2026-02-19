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

    // Get all events with a clickup_list_id
    const { data: events, error: eventsErr } = await supabase
      .from("events")
      .select("id, clickup_list_id, agent_id")
      .not("clickup_list_id", "is", null);

    if (eventsErr) throw eventsErr;
    if (!events || events.length === 0) {
      return new Response(JSON.stringify({ message: "No events with ClickUp lists found", synced: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build a profiles lookup by email for agent_id resolution
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, email");

    const emailToUserId: Record<string, string> = {};
    (profiles || []).forEach((p: any) => {
      if (p.email) emailToUserId[p.email.toLowerCase()] = p.user_id;
    });

    let totalSynced = 0;
    const errors: string[] = [];

    for (const event of events) {
      try {
        // Fetch tasks from ClickUp list
        const resp = await fetch(
          `https://api.clickup.com/api/v2/list/${event.clickup_list_id}/task?include_closed=true&subtasks=true`,
          {
            headers: {
              Authorization: CLICKUP_API_TOKEN,
              "Content-Type": "application/json",
            },
          }
        );

        if (!resp.ok) {
          errors.push(`List ${event.clickup_list_id}: HTTP ${resp.status}`);
          continue;
        }

        const data = await resp.json();
        const clickupTasks = data.tasks || [];

        // Filter for tasks with \"event\" tag (on task or parent)
        const lower = (s: any) => (typeof s === "string" ? s.toLowerCase() : "");
        const hasEventTag = (t: any): boolean =>
          Array.isArray(t?.tags) && t.tags.some((tag: any) => lower(tag?.name) === "event");

        for (const task of clickupTasks) {
          const include = hasEventTag(task);
          // Skip tasks without event tag (don't check parent to keep it fast)
          if (!include) continue;

          // Resolve agent_id from assignees
          let agentId: string | null = null;
          if (Array.isArray(task.assignees) && task.assignees.length > 0) {
            for (const assignee of task.assignees) {
              const email = (assignee.email || "").toLowerCase();
              if (email && emailToUserId[email]) {
                agentId = emailToUserId[email];
                break;
              }
            }
          }

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

          const upsertPayload = {
            event_id: event.id,
            clickup_task_id: task.id,
            task_name: task.name || "Untitled",
            status: status,
            due_date: dueDate,
            responsible_person: responsible || null,
            completed_at: isCompleted ? completedAt || new Date().toISOString() : null,
            agent_id: agentId || (event.agent_id || null),
            updated_at: new Date().toISOString(),
          };

          const { error: upsertErr } = await supabase
            .from("clickup_tasks")
            .upsert(upsertPayload, { onConflict: "clickup_task_id" });

          if (upsertErr) {
            errors.push(`Task ${task.id}: ${upsertErr.message}`);
          } else {
            totalSynced++;
          }
        }
      } catch (err: any) {
        errors.push(`Event ${event.id}: ${err.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        message: `Synced ${totalSynced} tasks across ${events.length} events`,
        synced: totalSynced,
        events: events.length,
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
