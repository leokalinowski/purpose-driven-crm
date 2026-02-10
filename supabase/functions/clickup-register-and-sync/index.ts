// deno-lint-ignore-file no-explicit-any

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type RegisterBody = {
  team_id: string;
  list_id: string;
  tag?: string; // default: 'event'
  event_id?: string; // optional; if not provided, link to the next upcoming event
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const CLICKUP_API_TOKEN = Deno.env.get("CLICKUP_API_TOKEN");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing Supabase env");
    if (!CLICKUP_API_TOKEN) throw new Error("Missing CLICKUP_API_TOKEN secret");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    const body: RegisterBody = await req.json();
    const teamId = body.team_id;
    const listId = body.list_id;
    const tag = (body.tag || "event").toLowerCase();
    let eventId = body.event_id;

    if (!teamId || !listId) throw new Error("team_id and list_id are required");

    // Find next upcoming event (for the calling agent) if not provided
    if (!eventId) {
      const authHeader = req.headers.get("authorization") || "";
      const token = authHeader.replace(/Bearer\s+/i, "");
      let userId: string | null = null;
      if (token) {
        try {
          const { data: userData } = await supabase.auth.getUser(token);
          userId = userData?.user?.id || null;
        } catch (_) {}
      }

      let query = supabase
        .from("events")
        .select("id")
        .gte("event_date", new Date().toISOString().slice(0, 10))
        .order("event_date", { ascending: true })
        .limit(1);

      if (userId) query = query.eq("agent_id", userId);

      const { data: nextEvent, error: nextErr } = await query.maybeSingle();
      if (nextErr) throw nextErr;
      if (!nextEvent) throw new Error("No upcoming event found to link for this user");
      eventId = nextEvent.id;
    }

    // 1) Link event to list
    const { error: updateEventErr } = await supabase
      .from("events")
      .update({ clickup_list_id: listId, updated_at: new Date().toISOString() })
      .eq("id", eventId);
    if (updateEventErr) throw updateEventErr;

    // 2) Create or refresh webhook in ClickUp
    const webhookEndpoint = `${SUPABASE_URL}/functions/v1/clickup-webhook`;
    const createWebhookResp = await fetch(`https://api.clickup.com/api/v2/team/${teamId}/webhook`, {
      method: "POST",
      headers: { "Authorization": CLICKUP_API_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: webhookEndpoint,
        events: [
          "taskCreated",
          "taskUpdated",
          "taskDeleted",
          "taskTimeTrackedUpdated",
          "taskAssigneeUpdated",
          "taskDueDateUpdated",
          "taskMoved",
        ],
        status: "active",
      }),
    });

    if (!createWebhookResp.ok) {
      const txt = await createWebhookResp.text();
      console.error("ClickUp webhook creation failed:", createWebhookResp.status, txt);
      throw new Error(`ClickUp webhook creation failed: ${createWebhookResp.status}`);
    }
    const webhookJson: any = await createWebhookResp.json();
    const webhookId: string | undefined = webhookJson?.webhook?.id || webhookJson?.id;

    // 3) Upsert metadata row
    await supabase
      .from("clickup_webhooks")
      .upsert({ list_id: listId, team_id: String(teamId), event_id: eventId, webhook_id: webhookId || null, active: true, last_sync_at: new Date().toISOString() }, { onConflict: "list_id" });

    // 4) Initial sync: fetch tasks (with subtasks) and insert those tagged with `tag`, plus their subtasks
    async function fetchListTasks(list: string): Promise<any[]> {
      const tasks: any[] = [];
      let page = 0;
      const limit = 100;
      while (true) {
        const url = new URL(`https://api.clickup.com/api/v2/list/${list}/task`);
        url.searchParams.set("subtasks", "true");
        url.searchParams.set("include_closed", "true");
        url.searchParams.set("page", String(page));
        url.searchParams.set("limit", String(limit));
        const resp = await fetch(url.toString(), { headers: { Authorization: CLICKUP_API_TOKEN } });
        if (!resp.ok) {
          console.warn("Task list fetch failed", resp.status);
          break;
        }
        const json: any = await resp.json();
        const batch = Array.isArray(json?.tasks) ? json.tasks : [];
        tasks.push(...batch);
        if (batch.length < limit) break;
        page += 1;
      }
      return tasks;
    }

    const allTasks = await fetchListTasks(listId);
    const tagSet = new Set<string>([tag]);

    const lower = (s: any) => (typeof s === "string" ? s.toLowerCase() : "");
    const hasTag = (t: any, tname: string) => Array.isArray(t?.tags) && t.tags.some((tg: any) => lower(tg?.name) === tname);

    const byId = new Map<string, any>();
    for (const t of allTasks) byId.set(String(t.id), t);

    const includeSet = new Set<string>();
    for (const t of allTasks) {
      if (hasTag(t, tag)) includeSet.add(String(t.id));
    }
    // include subtasks of included parents
    for (const t of allTasks) {
      const parent = t?.parent ? String(t.parent) : "";
      if (parent && includeSet.has(parent)) includeSet.add(String(t.id));
    }

    // Collect existing tasks to avoid duplicates
    const idsToSync = Array.from(includeSet);
    let existing: Record<string, string> = {};
    if (idsToSync.length) {
      const { data: existingRows, error: existingErr } = await supabase
        .from("clickup_tasks")
        .select("id, clickup_task_id")
        .in("clickup_task_id", idsToSync);
      if (existingErr) throw existingErr;
      existing = Object.fromEntries((existingRows || []).map((r: any) => [r.clickup_task_id, r.id]));
    }

    const inserts: any[] = [];
    const doneKeywords = ["done", "closed", "complete", "completed"];

    for (const id of idsToSync) {
      if (existing[id]) continue; // only insert new; updates will flow via webhook
      const t = byId.get(id);
      if (!t) continue;
      const status = t?.status?.status || t?.status;
      const rawDue = t?.due_date;
      let dueDate: string | null = null;
      if (rawDue) {
        try {
          const ms = typeof rawDue === "string" ? parseInt(rawDue) : rawDue;
          const d = new Date(isNaN(ms) ? rawDue : ms);
          if (!isNaN(d.getTime())) dueDate = d.toISOString().slice(0, 10);
        } catch (_) {}
      }
      const completedAtRaw = t?.date_done || t?.completed_at;
      let completedAt: string | null = null;
      if (completedAtRaw) {
        try {
          const ms = typeof completedAtRaw === "string" ? parseInt(completedAtRaw) : completedAtRaw;
          const d = new Date(isNaN(ms) ? completedAtRaw : ms);
          if (!isNaN(d.getTime())) completedAt = d.toISOString();
        } catch (_) {}
      }
      const assignees = Array.isArray(t?.assignees) ? t.assignees : [];
      const responsible = assignees.length ? assignees.map((a: any) => a.username || a.email || a.id).join(", ") : null;
      const isCompleted = status ? doneKeywords.includes(String(status).toLowerCase()) : false;

      inserts.push({
        event_id: eventId,
        clickup_task_id: id,
        task_name: t?.name || "Untitled",
        status: status || null,
        due_date: dueDate,
        responsible_person: responsible,
        completed_at: isCompleted ? completedAt || new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      });
    }

    if (inserts.length) {
      const { error: insErr } = await supabase.from("clickup_tasks").insert(inserts);
      if (insErr) throw insErr;
    }

    return new Response(
      JSON.stringify({ ok: true, linked_event_id: eventId, webhook_id: webhookId || null, inserted: inserts.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("register-and-sync error:", err);
    return new Response(JSON.stringify({ error: err?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
