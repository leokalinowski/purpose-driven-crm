// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(Math.ceil(hex.length / 2));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

async function verifySignature(bodyText: string, headerSig: string | null, secret: string | undefined) {
  if (!secret) return true; // If no secret configured, skip verification
  if (!headerSig) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const ok = await crypto.subtle.verify(
    "HMAC",
    key,
    hexToBytes(headerSig.replace(/^sha256=/, "")),
    new TextEncoder().encode(bodyText),
  );
  return ok;
}

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const bodyText = await req.text();
    const sigHeader = req.headers.get("x-clickup-signature") || req.headers.get("x-signature");
    const WEBHOOK_SECRET = Deno.env.get("CLICKUP_WEBHOOK_SECRET") || undefined;

    // Verify signature if secret is configured
    const isValid = await verifySignature(bodyText, sigHeader, WEBHOOK_SECRET);
    if (!isValid) {
      console.warn("Invalid ClickUp signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.parse(bodyText);
    console.log("Incoming ClickUp webhook:", JSON.stringify(payload).slice(0, 2000));

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Extract relevant fields from ClickUp payload in a robust way
    const listId: string | undefined = payload?.list_id || payload?.task?.list?.id || payload?.history_items?.[0]?.after?.list?.id;
    const taskId: string | undefined = payload?.task_id || payload?.task?.id || payload?.history_items?.[0]?.after?.id;

    if (!listId || !taskId) {
      console.log("Skipping webhook: missing listId or taskId");
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the related event by clickup_list_id
    const { data: eventRow, error: eventErr } = await supabase
      .from("events")
      .select("id")
      .eq("clickup_list_id", listId)
      .maybeSingle();

    if (eventErr) throw eventErr;
    if (!eventRow) {
      console.log("No matching event for list_id", listId);
      return new Response(JSON.stringify({ ok: true, unmatched_list: listId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch full task details from ClickUp to check tags and parent
    const CLICKUP_API_TOKEN = Deno.env.get("CLICKUP_API_TOKEN");
    if (!CLICKUP_API_TOKEN) throw new Error("Missing CLICKUP_API_TOKEN secret");

    async function fetchTask(taskIdToFetch: string) {
      const resp = await fetch(`https://api.clickup.com/api/v2/task/${taskIdToFetch}`, {
        headers: {
          "Authorization": CLICKUP_API_TOKEN,
          "Content-Type": "application/json",
        },
      });
      if (!resp.ok) {
        console.warn("ClickUp task fetch failed", taskIdToFetch, resp.status);
        return null;
      }
      return await resp.json();
    }

    const taskDetail: any = await fetchTask(taskId);
    if (!taskDetail) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lower = (s: any) => (typeof s === "string" ? s.toLowerCase() : "");
    const hasEventTag = (t: any): boolean => Array.isArray(t?.tags) && t.tags.some((tag: any) => lower(tag?.name) === "event");

    let include = hasEventTag(taskDetail);
    let parentDetail: any = null;
    if (!include && taskDetail?.parent) {
      parentDetail = await fetchTask(taskDetail.parent);
      include = hasEventTag(parentDetail);
    }

    if (!include) {
      console.log("Task ignored due to missing 'event' tag on task or parent", taskId);
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build task record from detailed payload
    const name: string = taskDetail?.name || "Untitled";
    const status: string | undefined = taskDetail?.status?.status || taskDetail?.status;

    // ClickUp due_date is ms timestamp string
    let dueDate: string | null = null;
    const rawDue = taskDetail?.due_date;
    if (rawDue) {
      try {
        const ms = typeof rawDue === "string" ? parseInt(rawDue) : rawDue;
        const d = new Date(isNaN(ms) ? rawDue : ms);
        if (!isNaN(d.getTime())) dueDate = d.toISOString().slice(0, 10);
      } catch (_) {}
    }

    const completedAtRaw = taskDetail?.date_done || taskDetail?.completed_at;
    let completedAt: string | null = null;
    if (completedAtRaw) {
      try {
        const ms = typeof completedAtRaw === "string" ? parseInt(completedAtRaw) : completedAtRaw;
        const d = new Date(isNaN(ms) ? completedAtRaw : ms);
        if (!isNaN(d.getTime())) completedAt = d.toISOString();
      } catch (_) {}
    }

    const assignees = taskDetail?.assignees || [];
    let responsible = "";
    if (Array.isArray(assignees) && assignees.length) {
      responsible = assignees.map((a: any) => a.username || a.email || a.id).join(", ");
    }

    const doneKeywords = ["done", "closed", "complete", "completed"];
    const isCompleted = status ? doneKeywords.includes(String(status).toLowerCase()) : false;

    const upsertPayload = {
      event_id: eventRow.id,
      clickup_task_id: taskId,
      task_name: name,
      status: status || null,
      due_date: dueDate,
      responsible_person: responsible || null,
      completed_at: isCompleted ? completedAt || new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    const { error: upsertErr } = await supabase
      .from("clickup_tasks")
      .upsert(upsertPayload, { onConflict: "clickup_task_id" });

    if (upsertErr) throw upsertErr;

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: err?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
