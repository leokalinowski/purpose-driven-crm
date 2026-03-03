import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const CLICKUP_API_TOKEN = Deno.env.get("CLICKUP_API_TOKEN");

    if (!CLICKUP_API_TOKEN) throw new Error("Missing CLICKUP_API_TOKEN");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Only sync events from the last 90 days or future events
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const cutoffDate = ninetyDaysAgo.toISOString().slice(0, 10);

    const { data: events, error: eventsErr } = await supabase
      .from("events")
      .select("id, agent_id, clickup_list_id, clickup_pre_event_list_id, clickup_event_day_list_id, clickup_post_event_list_id")
      .gte("event_date", cutoffDate);

    if (eventsErr) throw eventsErr;

    const eventsWithLists = (events || []).filter((e: any) =>
      e.clickup_pre_event_list_id || e.clickup_event_day_list_id || e.clickup_post_event_list_id || e.clickup_list_id
    );

    if (eventsWithLists.length === 0) {
      return new Response(JSON.stringify({ message: "No events with ClickUp lists found", synced: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalSynced = 0;
    const errors: string[] = [];

    // Paginated task fetcher
    async function fetchAllTasks(listId: string): Promise<any[]> {
      const tasks: any[] = [];
      let page = 0;
      const limit = 100;
      while (true) {
        const url = new URL(`https://api.clickup.com/api/v2/list/${listId}/task`);
        url.searchParams.set("include_closed", "true");
        url.searchParams.set("subtasks", "true");
        url.searchParams.set("page", String(page));
        url.searchParams.set("limit", String(limit));
        const resp = await fetch(url.toString(), {
          headers: { Authorization: CLICKUP_API_TOKEN!, "Content-Type": "application/json" },
        });
        if (!resp.ok) {
          errors.push(`List ${listId}: HTTP ${resp.status}`);
          break;
        }
        const data = await resp.json();
        const batch = Array.isArray(data?.tasks) ? data.tasks : [];
        tasks.push(...batch);
        if (batch.length < limit) break;
        page += 1;
      }
      return tasks;
    }

    const syncTasks = async (
      listId: string,
      eventId: string,
      eventAgentId: string | null,
      phase: string
    ) => {
      const clickupTasks = await fetchAllTasks(listId);
      let synced = 0;

      for (const task of clickupTasks) {
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
        if (event.clickup_pre_event_list_id) {
          totalSynced += await syncTasks(event.clickup_pre_event_list_id, event.id, event.agent_id, "pre_event");
        }
        if (event.clickup_event_day_list_id) {
          totalSynced += await syncTasks(event.clickup_event_day_list_id, event.id, event.agent_id, "event_day");
        }
        if (event.clickup_post_event_list_id) {
          totalSynced += await syncTasks(event.clickup_post_event_list_id, event.id, event.agent_id, "post_event");
        }

        if (!event.clickup_pre_event_list_id && !event.clickup_event_day_list_id && !event.clickup_post_event_list_id && event.clickup_list_id) {
          totalSynced += await syncTasks(event.clickup_list_id, event.id, event.agent_id, "pre_event");
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
