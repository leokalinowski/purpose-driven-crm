// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Helpers ──────────────────────────────────────────────────────────

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(Math.ceil(hex.length / 2));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

async function verifySignature(bodyText: string, headerSig: string | null, secret: string | undefined): Promise<boolean> {
  if (!secret) return true;
  if (!headerSig) return true;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify(
    "HMAC",
    key,
    hexToBytes(headerSig.replace(/^sha256=/, "")),
    new TextEncoder().encode(bodyText),
  );
}

function getCustomField(task: any, fieldName: string): any {
  if (!task?.custom_fields) return null;
  return task.custom_fields.find(
    (f: any) => f.name?.toLowerCase() === fieldName.toLowerCase(),
  ) ?? null;
}

function getCustomFieldValue(task: any, fieldName: string): string | null {
  const field = getCustomField(task, fieldName);
  if (!field) return null;
  if (typeof field.value === "string") return field.value;
  if (typeof field.value === "number") return String(field.value);
  if (field.type_config?.options && field.value !== undefined && field.value !== null) {
    const opt = field.type_config.options.find((o: any) => String(o.orderindex) === String(field.value));
    return opt?.name ?? String(field.value);
  }
  return field.value != null ? String(field.value) : null;
}

async function fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const resp = await fetch(url, options);
    if (resp.status === 429 || (resp.status >= 500 && resp.status < 600)) {
      const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
      console.warn(`Retry ${attempt + 1}/${retries} after ${resp.status}, waiting ${Math.round(delay)}ms`);
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }
    return resp;
  }
  return fetch(url, options);
}

// ── Main Handler ─────────────────────────────────────────────────────

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

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const CLICKUP_API_TOKEN = Deno.env.get("CLICKUP_API_TOKEN");
  const CLICKUP_WEBHOOK_SECRET = Deno.env.get("CLICKUP_WEBHOOK_SECRET");
  const SHADE_DRIVE_ID = Deno.env.get("SHADE_DRIVE_ID");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: "Missing Supabase config" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    // ── 1. Parse & verify webhook ────────────────────────────────────
    const bodyText = await req.text();
    const sigHeader = req.headers.get("x-clickup-signature") || req.headers.get("x-signature");
    const isValid = await verifySignature(bodyText, sigHeader, CLICKUP_WEBHOOK_SECRET);
    if (!isValid) {
      console.warn("Invalid ClickUp signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.parse(bodyText);
    console.log("Generate-copy webhook received:", JSON.stringify(payload).slice(0, 2000));

    const taskId: string | undefined = payload?.task_id || payload?.task?.id || payload?.payload?.id;
    if (!taskId) {
      console.log("No task_id in payload, skipping");
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 2. Idempotency check (task-level, not per-trigger) ─────────
    const idempotencyKey = `generate-copy:${taskId}`;

    const { data: existingRun } = await supabase
      .from("workflow_runs")
      .select("id, status, output")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existingRun) {
      const status = existingRun.status;

      // Already in progress — don't double-queue
      if (status === "queued" || status === "running") {
        console.log(`Run already ${status} for task ${taskId}, skipping`);
        return new Response(JSON.stringify({ ok: true, already_processing: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Truly complete — transcript was written back to ClickUp
      if (status === "success") {
        const clickupUpdates = (existingRun.output as any)?.clickup_updates;
        if (clickupUpdates?.["Video Transcription"] === "success") {
          console.log("Already fully completed for task:", taskId);
          return new Response(JSON.stringify({ ok: true, duplicate: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        // Otherwise allow re-queue (transcript was missing last time)
        console.log("Previous run succeeded but transcript was not written — re-queuing");
      }

      // failed / skipped / incomplete success → will be re-queued below
    }

    // ── 3. Fetch ClickUp task ────────────────────────────────────────
    if (!CLICKUP_API_TOKEN) throw new Error("Missing CLICKUP_API_TOKEN");

    const taskResp = await fetchWithRetry(`https://api.clickup.com/api/v2/task/${taskId}`, {
      headers: { Authorization: CLICKUP_API_TOKEN, "Content-Type": "application/json" },
    });
    if (!taskResp.ok) {
      const errText = await taskResp.text();
      throw new Error(`ClickUp task fetch failed [${taskResp.status}]: ${errText}`);
    }
    const task = await taskResp.json();

    // ── 4. Check "Generate Social Copy" checkbox ─────────────────────
    const checkboxField = getCustomField(task, "Generate Social Copy");
    const isChecked = checkboxField?.value === true || checkboxField?.value === "true";

    if (!isChecked) {
      console.log(`"Generate Social Copy" checkbox is not checked — skipping`);
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "checkbox_not_checked" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 5. Extract custom fields ─────────────────────────────────────
    const clientId = getCustomFieldValue(task, "Client ID (Supabase)");
    const shadeAssetIdField = getCustomFieldValue(task, "Shade Asset ID");

    // Parse Shade asset ID from task description
    const textContent = task?.text_content || task?.description || "";
    const idMatch = textContent.match(/\bID:\s*([a-f0-9-]{36})/i);
    const driveIdMatch = textContent.match(/\bDrive ID:\s*([a-f0-9-]{36})/i);

    const shadeAssetId = shadeAssetIdField || (idMatch ? idMatch[1] : null);
    const shadeDriveId = driveIdMatch ? driveIdMatch[1] : SHADE_DRIVE_ID;

    // ── 6. Enqueue into workflow_runs ────────────────────────────────
    const enrichedInput = {
      task_id: taskId,
      task_name: task.name,
      clickup_task_data: { custom_fields: task.custom_fields },
      shade_asset_id: shadeAssetId,
      shade_drive_id: shadeDriveId,
      client_id: clientId,
    };

    if (existingRun) {
      // Reuse existing run, reset to queued with fresh input
      await supabase
        .from("workflow_runs")
        .update({
          status: "queued",
          input: enrichedInput,
          output: null,
          error_message: null,
          started_at: null,
          finished_at: null,
        })
        .eq("id", existingRun.id);
      console.log("Re-queued existing run:", existingRun.id);
    } else {
      const { error: insertErr } = await supabase
        .from("workflow_runs")
        .insert({
          workflow_name: "generate-copy",
          idempotency_key: idempotencyKey,
          triggered_by: "clickup_webhook",
          input: enrichedInput,
          status: "queued",
        });
      if (insertErr) throw insertErr;
      console.log("Queued new run for task:", taskId);
    }

    // ── 7. Trigger processor (fire-and-forget) ──────────────────────
    try {
      fetch(`${SUPABASE_URL}/functions/v1/process-copy-queue`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ trigger: "webhook" }),
      }).catch(() => {}); // fire-and-forget
    } catch {
      // ignore - cron will pick it up
    }

    return new Response(
      JSON.stringify({ ok: true, queued: true, task_id: taskId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("clickup-generate-copy-webhook error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
