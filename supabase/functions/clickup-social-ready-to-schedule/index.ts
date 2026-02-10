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
  const field = task.custom_fields.find(
    (f: any) => f.name?.toLowerCase() === fieldName.toLowerCase(),
  );
  return field ?? null;
}

function getCustomFieldValue(task: any, fieldName: string): string | null {
  const field = getCustomField(task, fieldName);
  if (!field) return null;
  // Text / short-text / url fields
  if (typeof field.value === "string") return field.value;
  // Number / date fields stored as string
  if (typeof field.value === "number") return String(field.value);
  // Drop-down fields
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
  // Final attempt
  return fetch(url, options);
}

function formatPublishDate(unixMs: number): string {
  // Format as YYYY-MM-DDTHH:mm:ss in America/New_York
  const d = new Date(unixMs);
  // Use Intl to get parts in the right timezone
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts: Record<string, string> = {};
  for (const p of fmt.formatToParts(d)) {
    parts[p.type] = p.value;
  }
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
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

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const CLICKUP_API_TOKEN = Deno.env.get("CLICKUP_API_TOKEN");
  const CLICKUP_WEBHOOK_SECRET = Deno.env.get("CLICKUP_WEBHOOK_SECRET");
  const SHADE_API_KEY = Deno.env.get("SHADE_API_KEY");
  const SHADE_DRIVE_ID = Deno.env.get("SHADE_DRIVE_ID");
  const METRICOOL_API_KEY = Deno.env.get("METRICOOL_API_KEY");

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
    console.log("Ready-to-schedule webhook:", JSON.stringify(payload).slice(0, 2000));

    const taskId: string | undefined = payload?.task_id || payload?.task?.id || payload?.payload?.id;
    const eventId: string = payload?.event || payload?.webhook_id || "unknown";

    if (!taskId) {
      console.log("No task_id in payload, skipping");
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 2. Idempotency check ─────────────────────────────────────────
    const idempotencyKey = `schedule:${taskId}:${eventId}`;

    const { data: existingRun } = await supabase
      .from("workflow_runs")
      .select("id, status")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existingRun?.status === "success") {
      console.log("Already processed:", idempotencyKey);
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
          workflow_name: "schedule",
          idempotency_key: idempotencyKey,
          triggered_by: "clickup_webhook",
          input: { task_id: taskId, event: eventId },
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

    // ── 3b. Status filter — only process "Ready to Schedule" ─────────
    const taskStatus = task?.status?.status?.toLowerCase();
    if (taskStatus !== "ready to schedule") {
      console.log(`Task status is "${task?.status?.status}", not "Ready to Schedule" — skipping`);
      await supabase
        .from("workflow_runs")
        .update({ status: "skipped", finished_at: new Date().toISOString(), error_message: `Wrong status: ${task?.status?.status}` })
        .eq("id", runId);
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "wrong_status", actual_status: task?.status?.status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 4. Extract custom fields ─────────────────────────────────────
    const clientId = getCustomFieldValue(task, "Client ID (Supabase)");
    const shadeAssetId = getCustomFieldValue(task, "Shade Asset ID");
    const publishDateRaw = getCustomFieldValue(task, "Publish Date");

    if (!clientId) throw new Error("Missing 'Client ID (Supabase)' custom field");
    if (!shadeAssetId) throw new Error("Missing 'Shade Asset ID' custom field");
    if (!publishDateRaw) throw new Error("Missing 'Publish Date' custom field");

    const publishDateMs = parseInt(publishDateRaw);
    if (isNaN(publishDateMs)) throw new Error(`Invalid Publish Date: ${publishDateRaw}`);

    await logStep(supabase, runId!, "extract_custom_fields", "success", null, {
      clientId,
      shadeAssetId,
      publishDateMs,
    });

    // ── 5. Fetch agent profile & marketing settings ──────────────────
    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("user_id, first_name, last_name")
      .eq("user_id", clientId)
      .single();
    if (profErr || !profile) throw new Error(`Profile not found for clientId: ${clientId}`);

    const { data: mktSettings, error: mktErr } = await supabase
      .from("agent_marketing_settings")
      .select("*")
      .eq("user_id", profile.user_id)
      .single();
    if (mktErr || !mktSettings) throw new Error(`Marketing settings not found for user: ${profile.user_id}`);

    const metricoolBrandId = mktSettings.metricool_brand_id;
    if (!metricoolBrandId) throw new Error("Missing metricool_brand_id in agent_marketing_settings");

    await logStep(supabase, runId!, "fetch_agent_settings", "success", { clientId }, {
      user_id: profile.user_id,
      metricool_brand_id: metricoolBrandId,
    });

    // ── 5b. Fetch content generation results (social copy + YouTube title) ──
    let socialCopy = "";
    let youtubeTitle = "";
    const { data: contentResult } = await supabase
      .from("content_generation_results")
      .select("social_copy, youtube_titles")
      .eq("clickup_task_id", taskId)
      .eq("status", "completed")
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (contentResult) {
      socialCopy = contentResult.social_copy || "";
      // youtube_titles may be a JSON string with multiple titles; take the first
      if (contentResult.youtube_titles) {
        try {
          const titles = JSON.parse(contentResult.youtube_titles);
          youtubeTitle = Array.isArray(titles) ? titles[0] || "" : String(titles);
        } catch {
          youtubeTitle = contentResult.youtube_titles;
        }
      }
    }

    await logStep(supabase, runId!, "fetch_content_results", "success", null, {
      hasSocialCopy: !!socialCopy,
      hasYoutubeTitle: !!youtubeTitle,
    });

    // ── 6. Get Shade download URL ────────────────────────────────────
    if (!SHADE_API_KEY || !SHADE_DRIVE_ID) throw new Error("Missing SHADE_API_KEY or SHADE_DRIVE_ID");

    const shadeUrl = `https://api.shade.inc/assets/${shadeAssetId}/download?drive_id=${SHADE_DRIVE_ID}&origin_type=SOURCE&asset_id=${shadeAssetId}`;
    const shadeResp = await fetchWithRetry(shadeUrl, {
      headers: { Authorization: SHADE_API_KEY },
    });
    if (!shadeResp.ok) {
      const errText = await shadeResp.text();
      throw new Error(`Shade download failed [${shadeResp.status}]: ${errText}`);
    }
    const shadeData = await shadeResp.json();
    const videoDownloadUrl: string = shadeData?.url || shadeData?.download_url || shadeData;
    if (!videoDownloadUrl || typeof videoDownloadUrl !== "string") {
      throw new Error("No download URL returned from Shade");
    }

    await logStep(supabase, runId!, "shade_download_url", "success", { shadeAssetId }, {
      url: videoDownloadUrl.slice(0, 200),
    });

    // ── 7. Metricool: normalize media URL ────────────────────────────
    if (!METRICOOL_API_KEY) throw new Error("Missing METRICOOL_API_KEY");

    const normalizeUrl = `https://app.metricool.com/actions/normalize/image/url?url=${encodeURIComponent(videoDownloadUrl)}&userId=${metricoolBrandId}&blogId=${metricoolBrandId}`;
    const normalizeResp = await fetchWithRetry(normalizeUrl, {
      headers: { "X-Mc-Auth": METRICOOL_API_KEY },
    });
    if (!normalizeResp.ok) {
      const errText = await normalizeResp.text();
      throw new Error(`Metricool normalize failed [${normalizeResp.status}]: ${errText}`);
    }
    const normalizedMediaUrl = await normalizeResp.text();
    if (!normalizedMediaUrl) throw new Error("Empty normalized URL from Metricool");

    await logStep(supabase, runId!, "metricool_normalize", "success", null, {
      normalizedUrl: normalizedMediaUrl.slice(0, 200),
    });

    // ── 8. Metricool: schedule post ──────────────────────────────────
    const publicationDate = formatPublishDate(publishDateMs);

    // Build providers array from agent marketing settings
    const providers: any[] = [];
    if (mktSettings.metricool_facebook_id) {
      providers.push({
        blogKey: mktSettings.metricool_facebook_id,
        network: "FACEBOOK",
      });
    }
    if (mktSettings.metricool_instagram_id) {
      providers.push({
        blogKey: mktSettings.metricool_instagram_id,
        network: "INSTAGRAM",
        instagramPublishMode: "REEL",
      });
    }
    if (mktSettings.metricool_linkedin_id) {
      providers.push({
        blogKey: mktSettings.metricool_linkedin_id,
        network: "LINKEDIN",
      });
    }
    if (mktSettings.metricool_threads_id) {
      providers.push({
        blogKey: mktSettings.metricool_threads_id,
        network: "THREADS",
      });
    }
    if (mktSettings.metricool_tiktok_id) {
      providers.push({
        blogKey: mktSettings.metricool_tiktok_id,
        network: "TIKTOK",
      });
    }
    if (mktSettings.metricool_twitter_id) {
      providers.push({
        blogKey: mktSettings.metricool_twitter_id,
        network: "TWITTER",
      });
    }
    if (mktSettings.metricool_gmb_id) {
      providers.push({
        blogKey: mktSettings.metricool_gmb_id,
        network: "GOOGLE_MY_BUSINESS",
      });
    }
    if (mktSettings.metricool_youtube_id) {
      providers.push({
        blogKey: mktSettings.metricool_youtube_id,
        network: "YOUTUBE",
        youtubeData: {
          title: youtubeTitle || task.name || "Video",
          visibility: "PUBLIC",
          shorts: true,
        },
      });
    }

    if (providers.length === 0) {
      throw new Error("No Metricool social platform IDs configured for this agent");
    }

    const schedulePayload = {
      autoPublish: true,
      draft: false,
      publicationDate,
      timezone: "America/New_York",
      text: socialCopy,
      media: [normalizedMediaUrl],
      providers,
    };

    const scheduleResp = await fetchWithRetry(
      `https://app.metricool.com/api/v2/scheduler/posts?userId=${metricoolBrandId}&blogId=${metricoolBrandId}`,
      {
        method: "POST",
        headers: {
          "X-Mc-Auth": METRICOOL_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(schedulePayload),
      },
    );

    const scheduleBody = await scheduleResp.text();
    if (!scheduleResp.ok) {
      throw new Error(`Metricool schedule failed [${scheduleResp.status}]: ${scheduleBody}`);
    }

    await logStep(supabase, runId!, "metricool_schedule", "success", {
      publicationDate,
      providerCount: providers.length,
    }, { response: scheduleBody.slice(0, 2000) });

    // ── 9. Mark run as success ───────────────────────────────────────
    await supabase
      .from("workflow_runs")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
      })
      .eq("id", runId);

    const summary = {
      ok: true,
      task_id: taskId,
      agent: `${profile.first_name} ${profile.last_name}`,
      platforms: providers.map((p: any) => p.network),
      publicationDate,
    };
    console.log("Schedule complete:", JSON.stringify(summary));

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Ready-to-schedule error:", err);

    // Log failure to workflow_runs
    if (runId) {
      await logStep(supabase, runId, "error", "failed", null, null, err.message);
      await supabase
        .from("workflow_runs")
        .update({
          status: "failed",
          error_message: err.message?.slice(0, 2000),
          finished_at: new Date().toISOString(),
        })
        .eq("id", runId);
    }

    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
