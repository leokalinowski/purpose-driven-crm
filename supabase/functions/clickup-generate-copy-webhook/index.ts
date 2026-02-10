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

// ── Step Logger ──────────────────────────────────────────────────────

async function logStep(
  supabase: any,
  runId: string,
  stepName: string,
  status: "running" | "success" | "failed",
  input?: any,
  output?: any,
  errorMsg?: string,
) {
  try {
    await supabase.from("workflow_run_steps").insert({
      run_id: runId,
      step_name: stepName,
      status,
      request: input || null,
      response_body: output || null,
      error_message: errorMsg?.slice(0, 2000) || null,
      started_at: new Date().toISOString(),
      finished_at: status !== "running" ? new Date().toISOString() : null,
    });
  } catch (e: any) {
    console.error("Failed to log step:", e.message);
  }
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
  const SHADE_API_KEY = Deno.env.get("SHADE_API_KEY");
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

  let runId: string | null = null;

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

    // ── 2. Idempotency check ─────────────────────────────────────────
    const autoId = payload?.auto_id || "";
    const idempotencyKey = autoId
      ? `generate-copy:${taskId}:${autoId}`
      : `generate-copy:${taskId}`;

    const { data: existingRun } = await supabase
      .from("workflow_runs")
      .select("id, status")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existingRun?.status === "success") {
      console.log("Already generated copy for this task:", idempotencyKey);
      return new Response(JSON.stringify({ ok: true, duplicate: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create or reuse run
    if (existingRun) {
      runId = existingRun.id;
      await supabase
        .from("workflow_runs")
        .update({ status: "running", started_at: new Date().toISOString(), error_message: null })
        .eq("id", runId);
    } else {
      const { data: newRun, error: runErr } = await supabase
        .from("workflow_runs")
        .insert({
          workflow_name: "generate-copy",
          idempotency_key: idempotencyKey,
          triggered_by: "clickup_webhook",
          input: { task_id: taskId },
          status: "running",
          started_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (runErr) throw runErr;
      runId = newRun.id;
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
    await logStep(supabase, runId!, "fetch_clickup_task", "success", { task_id: taskId }, { name: task.name, status: task?.status?.status });

    // ── 4. Check "Generate Social Copy" checkbox ─────────────────────
    const checkboxField = getCustomField(task, "Generate Social Copy");
    const isChecked = checkboxField?.value === true || checkboxField?.value === "true";

    if (!isChecked) {
      console.log(`"Generate Social Copy" checkbox is not checked — skipping`);
      await supabase
        .from("workflow_runs")
        .update({ status: "skipped", finished_at: new Date().toISOString(), error_message: "Checkbox not checked" })
        .eq("id", runId);
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "checkbox_not_checked" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await logStep(supabase, runId!, "check_checkbox", "success", null, { checked: true });

    // ── 5. Extract custom fields ─────────────────────────────────────
    const clientId = getCustomFieldValue(task, "Client ID (Supabase)");
    const shadeAssetIdField = getCustomFieldValue(task, "Shade Asset ID");

    await logStep(supabase, runId!, "extract_fields", "success", null, {
      clientId,
      shadeAssetIdField,
    });

    // ── 5b. Parse Shade asset ID from task description ─────────────
    const textContent = task?.text_content || task?.description || "";
    const idMatch = textContent.match(/\bID:\s*([a-f0-9-]{36})/i);
    const driveIdMatch = textContent.match(/\bDrive ID:\s*([a-f0-9-]{36})/i);

    const shadeAssetId = shadeAssetIdField || (idMatch ? idMatch[1] : null);
    const shadeDriveId = driveIdMatch ? driveIdMatch[1] : SHADE_DRIVE_ID;

    await logStep(supabase, runId!, "parse_shade_ids", "success", null, {
      shadeAssetId,
      shadeDriveId: SHADE_DRIVE_ID ? "present" : "missing",
      parsedFromDescription: !!idMatch,
    });

    // ── 5c. Fetch transcript from Shade API ──────────────────────────
    let transcript = "";

    if (shadeAssetId && SHADE_API_KEY && shadeDriveId) {
      try {
        await logStep(supabase, runId!, "fetch_shade_transcript", "running", { shadeAssetId });

        const shadeUrl = `https://api.shade.inc/assets/${shadeAssetId}/transcription/file?drive_id=${shadeDriveId}&type=txt`;
        const shadeResp = await fetchWithRetry(shadeUrl, {
          headers: {
            Authorization: `Bearer ${SHADE_API_KEY}`,
          },
        });

        if (shadeResp.ok) {
          transcript = await shadeResp.text();

          await logStep(supabase, runId!, "fetch_shade_transcript", "success", null, {
            transcriptLength: transcript.length,
          });
        } else {
          const errText = await shadeResp.text();
          console.warn(`Shade transcript fetch failed [${shadeResp.status}]: ${errText}`);
          await logStep(supabase, runId!, "fetch_shade_transcript", "failed", null, null,
            `Shade API [${shadeResp.status}]: ${errText.slice(0, 500)}`);
        }
      } catch (e: any) {
        console.warn("Shade transcript fetch error:", e.message);
        await logStep(supabase, runId!, "fetch_shade_transcript", "failed", null, null, e.message);
      }
    } else {
      console.log("Skipping Shade fetch: missing asset ID, API key, or drive ID");
      await logStep(supabase, runId!, "fetch_shade_transcript", "skipped", null, {
        hasAssetId: !!shadeAssetId,
        hasApiKey: !!SHADE_API_KEY,
        hasDriveId: !!SHADE_DRIVE_ID,
      });
    }

    // ── 6. Call generate-social-copy function ────────────────────────
    const generatePayload = {
      clickup_task_id: taskId,
      transcript: transcript || undefined,
      video_description: !transcript ? task?.name : undefined,
      client_id: clientId || undefined,
      shade_asset_id: shadeAssetId || undefined,
    };

    await logStep(supabase, runId!, "call_generate_social_copy", "running", {
      ...generatePayload,
      transcriptLength: transcript.length,
    });

    const genResp = await fetch(`${SUPABASE_URL}/functions/v1/generate-social-copy`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(generatePayload),
    });

    const genBody = await genResp.json();

    if (!genResp.ok) {
      throw new Error(`generate-social-copy failed [${genResp.status}]: ${JSON.stringify(genBody)}`);
    }

    await logStep(supabase, runId!, "call_generate_social_copy", "success", null, {
      id: genBody.id,
      duplicate: genBody.duplicate || false,
      copyLength: genBody.social_copy?.length || 0,
    });

    // ── 6b. Write generated content back to ClickUp ──────────────────
    const fieldUpdates: { name: string; value: string }[] = [];

    // Social copy
    if (genBody.social_copy) {
      fieldUpdates.push({ name: "Generated Copy", value: genBody.social_copy });
    }

    // YT Title — first from the array
    if (genBody.youtube_titles) {
      try {
        const titles = typeof genBody.youtube_titles === "string"
          ? JSON.parse(genBody.youtube_titles)
          : genBody.youtube_titles;
        if (Array.isArray(titles) && titles.length > 0) {
          fieldUpdates.push({ name: "YT Title", value: titles[0] });
        }
      } catch {
        console.warn("Could not parse youtube_titles:", genBody.youtube_titles);
      }
    }

    // YT Description
    if (genBody.youtube_description) {
      fieldUpdates.push({ name: "YT Description", value: genBody.youtube_description });
    }

    // Write transcript back to ClickUp
    if (transcript) {
      fieldUpdates.push({ name: "Video Transcription", value: transcript });
    }

    const clickupUpdateResults: Record<string, string> = {};

    for (const update of fieldUpdates) {
      const field = getCustomField(task, update.name);
      if (!field?.id) {
        console.warn(`ClickUp field "${update.name}" not found on task — skipping`);
        clickupUpdateResults[update.name] = "field_not_found";
        continue;
      }
      try {
        const resp = await fetchWithRetry(
          `https://api.clickup.com/api/v2/task/${taskId}/field/${field.id}`,
          {
            method: "POST",
            headers: { Authorization: CLICKUP_API_TOKEN!, "Content-Type": "application/json" },
            body: JSON.stringify({ value: update.value }),
          },
        );
        if (!resp.ok) {
          const errText = await resp.text();
          console.warn(`Failed to update "${update.name}" [${resp.status}]: ${errText}`);
          clickupUpdateResults[update.name] = `error_${resp.status}`;
        } else {
          clickupUpdateResults[update.name] = "success";
        }
      } catch (e: any) {
        console.warn(`Error updating "${update.name}":`, e.message);
        clickupUpdateResults[update.name] = `exception: ${e.message}`;
      }
    }

    await logStep(supabase, runId!, "update_clickup_fields", "success", null, clickupUpdateResults);

    // ── 7. Mark run as success ───────────────────────────────────────
    await supabase
      .from("workflow_runs")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        output: {
          content_id: genBody.id,
          duplicate: genBody.duplicate || false,
          task_name: task.name,
        },
      })
      .eq("id", runId);

    console.log("Content generation triggered successfully:", { taskId, contentId: genBody.id });

    return new Response(
      JSON.stringify({
        ok: true,
        content_id: genBody.id,
        duplicate: genBody.duplicate || false,
        social_copy: genBody.social_copy,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("clickup-generate-copy-webhook error:", err);

    if (runId) {
      await logStep(supabase, runId, "error", "failed", null, null, err.message);
      await supabase
        .from("workflow_runs")
        .update({ status: "failed", finished_at: new Date().toISOString(), error_message: err.message?.slice(0, 2000) })
        .eq("id", runId);
    }

    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
