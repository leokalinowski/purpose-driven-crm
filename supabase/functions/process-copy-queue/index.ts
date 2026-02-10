// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DELAY_BETWEEN_ITEMS_MS = 3000;

// ── Helpers ──────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const resp = await fetch(url, options);
    if (resp.status === 429 || (resp.status >= 500 && resp.status < 600)) {
      const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
      console.warn(`Retry ${attempt + 1}/${retries} after ${resp.status}, waiting ${Math.round(delay)}ms`);
      await sleep(delay);
      continue;
    }
    return resp;
  }
  return fetch(url, options);
}

function getCustomField(customFields: any[], fieldName: string): any {
  if (!customFields) return null;
  return customFields.find(
    (f: any) => f.name?.toLowerCase() === fieldName.toLowerCase(),
  ) ?? null;
}

async function logStep(
  supabase: any,
  runId: string,
  stepName: string,
  status: "running" | "success" | "failed" | "skipped",
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

// ── Process a single queued run ──────────────────────────────────────

async function processRun(
  supabase: any,
  run: any,
  CLICKUP_API_TOKEN: string,
  SHADE_API_KEY: string,
  SUPABASE_URL: string,
  SUPABASE_SERVICE_ROLE_KEY: string,
) {
  const runId = run.id;
  const input = run.input;
  const taskId = input.task_id;

  console.log(`Processing run ${runId} for task ${taskId}`);

  // Mark as running
  await supabase
    .from("workflow_runs")
    .update({ status: "running", started_at: new Date().toISOString(), error_message: null })
    .eq("id", runId);

  try {
    // ── 1. Fetch transcript from Shade ─────────────────────────────
    const shadeAssetId = input.shade_asset_id;
    const shadeDriveId = input.shade_drive_id;
    let transcript = "";

    if (!shadeAssetId || !SHADE_API_KEY || !shadeDriveId) {
      const reason = `Missing: ${!shadeAssetId ? "asset_id " : ""}${!SHADE_API_KEY ? "api_key " : ""}${!shadeDriveId ? "drive_id" : ""}`.trim();
      console.log(`Cannot fetch transcript for ${taskId}: ${reason}`);
      await logStep(supabase, runId, "fetch_shade_transcript", "skipped", null, { reason });

      // SKIP — no transcript means no generation
      await supabase
        .from("workflow_runs")
        .update({
          status: "skipped",
          finished_at: new Date().toISOString(),
          error_message: `Transcript not available - copy generation requires a transcript. ${reason}`,
        })
        .eq("id", runId);
      return;
    }

    await logStep(supabase, runId, "fetch_shade_transcript", "running", { shadeAssetId, shadeDriveId });

    const shadeUrl = `https://api.shade.inc/assets/${shadeAssetId}/transcription/file?drive_id=${shadeDriveId}&type=txt`;
    const shadeResp = await fetchWithRetry(shadeUrl, {
      headers: { Authorization: SHADE_API_KEY },
    });

    if (shadeResp.ok) {
      transcript = await shadeResp.text();
      await logStep(supabase, runId, "fetch_shade_transcript", "success", null, {
        transcriptLength: transcript.length,
      });
    } else {
      const errText = await shadeResp.text();
      console.warn(`Shade transcript fetch failed [${shadeResp.status}]: ${errText}`);
      await logStep(supabase, runId, "fetch_shade_transcript", "failed", null, null,
        `Shade API [${shadeResp.status}]: ${errText.slice(0, 500)}`);
    }

    // ── 2. Check transcript requirement ────────────────────────────
    if (!transcript || transcript.trim().length === 0) {
      console.log(`No transcript for task ${taskId} — skipping generation`);
      await logStep(supabase, runId, "transcript_check", "skipped", null, {
        reason: "Transcript not available - copy generation requires a transcript",
      });
      await supabase
        .from("workflow_runs")
        .update({
          status: "skipped",
          finished_at: new Date().toISOString(),
          error_message: "Transcript not available - copy generation requires a transcript",
        })
        .eq("id", runId);
      return;
    }

    await logStep(supabase, runId, "transcript_check", "success", null, {
      transcriptLength: transcript.length,
    });

    // ── 3. Call generate-social-copy ────────────────────────────────
    const generatePayload = {
      clickup_task_id: taskId,
      transcript,
      client_id: input.client_id || undefined,
      shade_asset_id: shadeAssetId || undefined,
    };

    await logStep(supabase, runId, "call_generate_social_copy", "running", {
      ...generatePayload,
      transcriptLength: transcript.length,
      transcript: undefined, // don't log full transcript
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

    await logStep(supabase, runId, "call_generate_social_copy", "success", null, {
      id: genBody.id,
      duplicate: genBody.duplicate || false,
      copyLength: genBody.social_copy?.length || 0,
    });

    // ── 4. Write generated content back to ClickUp ─────────────────
    const customFields = input.clickup_task_data?.custom_fields || [];

    const fieldUpdates: { name: string; value: string }[] = [];

    if (genBody.social_copy) {
      fieldUpdates.push({ name: "Generated Copy", value: genBody.social_copy });
    }

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

    if (genBody.youtube_description) {
      fieldUpdates.push({ name: "YT Description", value: genBody.youtube_description });
    }

    if (transcript) {
      fieldUpdates.push({ name: "Video Transcription", value: transcript });
    }

    const clickupUpdateResults: Record<string, string> = {};

    for (const update of fieldUpdates) {
      const field = getCustomField(customFields, update.name);
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
            headers: { Authorization: CLICKUP_API_TOKEN, "Content-Type": "application/json" },
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

    await logStep(supabase, runId, "update_clickup_fields", "success", null, clickupUpdateResults);

    // ── 5. Mark run as success ─────────────────────────────────────
    await supabase
      .from("workflow_runs")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        output: {
          content_id: genBody.id,
          duplicate: genBody.duplicate || false,
          task_name: input.task_name,
          clickup_updates: clickupUpdateResults,
        },
      })
      .eq("id", runId);

    console.log(`Run ${runId} completed successfully for task ${taskId}`);
  } catch (err: any) {
    console.error(`Run ${runId} failed:`, err.message);
    await logStep(supabase, runId, "error", "failed", null, null, err.message);
    await supabase
      .from("workflow_runs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error_message: err.message?.slice(0, 2000),
      })
      .eq("id", runId);
  }
}

// ── Main Handler ─────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const CLICKUP_API_TOKEN = Deno.env.get("CLICKUP_API_TOKEN")!;
  const SHADE_API_KEY = Deno.env.get("SHADE_API_KEY")!;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    // ── 1. Claim queued runs ───────────────────────────────────────
    const { data: queuedRuns, error: fetchErr } = await supabase
      .from("workflow_runs")
      .select("*")
      .eq("workflow_name", "generate-copy")
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(10);

    if (fetchErr) throw fetchErr;

    if (!queuedRuns || queuedRuns.length === 0) {
      console.log("No queued runs to process");
      return new Response(JSON.stringify({ ok: true, processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${queuedRuns.length} queued runs to process`);

    // ── 2. Process each run sequentially with delays ───────────────
    let processed = 0;

    for (let i = 0; i < queuedRuns.length; i++) {
      const run = queuedRuns[i];

      // Re-check status to prevent double-processing
      const { data: current } = await supabase
        .from("workflow_runs")
        .select("status")
        .eq("id", run.id)
        .single();

      if (current?.status !== "queued") {
        console.log(`Run ${run.id} already claimed (status: ${current?.status}), skipping`);
        continue;
      }

      await processRun(supabase, run, CLICKUP_API_TOKEN, SHADE_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      processed++;

      // Delay between items to respect Shade rate limits
      if (i < queuedRuns.length - 1) {
        console.log(`Waiting ${DELAY_BETWEEN_ITEMS_MS}ms before next item...`);
        await sleep(DELAY_BETWEEN_ITEMS_MS);
      }
    }

    // ── 3. Check if more items remain ──────────────────────────────
    const { count } = await supabase
      .from("workflow_runs")
      .select("id", { count: "exact", head: true })
      .eq("workflow_name", "generate-copy")
      .eq("status", "queued");

    if (count && count > 0) {
      console.log(`${count} more queued runs remaining, triggering self...`);
      // Wait before self-invoking to space out Shade calls
      await sleep(DELAY_BETWEEN_ITEMS_MS);
      fetch(`${SUPABASE_URL}/functions/v1/process-copy-queue`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ trigger: "self-continuation" }),
      }).catch(() => {}); // fire-and-forget
    }

    return new Response(
      JSON.stringify({ ok: true, processed, remaining: count || 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("process-copy-queue error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
