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
  if (!headerSig) return true; // ClickUp Automations don't send signatures
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
  const CLICKUP_WEBHOOK_SECRET = Deno.env.get("CLICKUP_WEBHOOK_SECRET");

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
    console.log("Generate-thumbnail webhook received:", JSON.stringify(payload).slice(0, 2000));

    // ── 2. Extract task ID ───────────────────────────────────────────
    const taskId: string | undefined = payload?.task_id || payload?.task?.id || payload?.payload?.id;
    if (!taskId) {
      console.log("No task_id in payload, skipping");
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 3. Idempotency check ─────────────────────────────────────────
    const idempotencyKey = `generate-thumbnail:${taskId}`;

    const { data: existingRun } = await supabase
      .from("workflow_runs")
      .select("id, status")
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

      // success: always allow re-queue (thumbnails may be regenerated on demand)
      // failed/skipped: re-queue
      // All non-queued/running statuses fall through to re-queue below
    }

    // ── 4. Enqueue into workflow_runs ────────────────────────────────
    const input = { task_id: taskId };

    if (existingRun) {
      await supabase
        .from("workflow_runs")
        .update({
          status: "queued",
          input,
          output: null,
          error_message: null,
          started_at: null,
          finished_at: null,
        })
        .eq("id", existingRun.id);
      console.log("Re-queued existing thumbnail run:", existingRun.id);
    } else {
      const { error: insertErr } = await supabase
        .from("workflow_runs")
        .insert({
          workflow_name: "generate-thumbnail",
          idempotency_key: idempotencyKey,
          triggered_by: "clickup_webhook",
          input,
          status: "queued",
        });
      if (insertErr) throw insertErr;
      console.log("Queued new thumbnail run for task:", taskId);
    }

    // ── 5. Trigger processor (fire-and-forget) ──────────────────────
    try {
      fetch(`${SUPABASE_URL}/functions/v1/process-thumbnail-queue`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ trigger: "webhook" }),
      }).catch(() => {});
    } catch {
      // ignore - cron will pick it up
    }

    return new Response(
      JSON.stringify({ ok: true, queued: true, task_id: taskId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("clickup-generate-thumbnail-webhook error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
