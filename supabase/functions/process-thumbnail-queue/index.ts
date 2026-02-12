// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DELAY_BETWEEN_ITEMS_MS = 5000;
const PLACID_TEMPLATE_UUID = "nlhaoglryb9fg";
const CLICKUP_THUMBNAIL_FIELD_ID = "d1d4739b-5009-4cac-b8ec-a1e16de2be05";

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

function getCustomFieldValue(customFields: any[], fieldName: string): string | null {
  if (!customFields) return null;
  const field = customFields.find(
    (f: any) => f.name?.toLowerCase() === fieldName.toLowerCase(),
  );
  if (!field) return null;
  if (typeof field.value === "string") return field.value;
  if (typeof field.value === "number") return String(field.value);
  return field.value != null ? String(field.value) : null;
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

// ── Image generation via Lovable AI gateway ─────────────────────────

async function generateBaseImage(
  referenceImageUrl: string,
  backgroundPrompt: string,
  thumbnailGuidelines: string | null,
  aspectRatio: "9:16" | "16:9",
  LOVABLE_API_KEY: string,
): Promise<string> {
  const orientationInstruction = aspectRatio === "9:16"
    ? "Portrait orientation (9:16 aspect ratio). The subject should be positioned prominently."
    : "Landscape orientation (16:9 aspect ratio). The subject should be positioned prominently, leaving space for text.";

  const prompt = `You are a professional thumbnail image generator. Using the reference photo provided, create a new image that:
1. PRESERVES the subject's facial identity and likeness exactly — same face, same features, same skin tone
2. Places the subject in a new background: ${backgroundPrompt}
3. The background must contain NO other people, NO text, NO logos, NO watermarks
4. ${orientationInstruction}
5. Extreme detail, sharp focus, professional lighting, cinematic quality
6. The subject should look confident and approachable
${thumbnailGuidelines ? `7. Additional guidelines: ${thumbnailGuidelines}` : ""}

CRITICAL: The person's face must be clearly recognizable as the same person from the reference photo.`;

  const resp = await fetchWithRetry("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: referenceImageUrl } },
          ],
        },
      ],
      modalities: ["image", "text"],
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`AI image generation failed [${resp.status}]: ${errText.slice(0, 500)}`);
  }

  const data = await resp.json();
  const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!imageUrl) {
    throw new Error("AI returned no image data");
  }
  return imageUrl; // data:image/png;base64,...
}

// ── Title generation via Lovable AI gateway ─────────────────────────

async function generateTitle(
  transcript: string | null,
  prompt: string | null,
  thumbnailGuidelines: string | null,
  taskName: string,
  LOVABLE_API_KEY: string,
): Promise<string> {
  const systemPrompt = `You generate short, compelling thumbnail titles for YouTube videos. Rules:
- 3 to 8 words ONLY
- No clickbait, no hype, no ALL CAPS
- Confident, calm, authoritative tone
- Must feel natural and conversational
- Output ONLY the title text, nothing else — no quotes, no commentary, no explanation`;

  let userPrompt = "Generate a thumbnail title";
  if (transcript) {
    userPrompt += `\n\nVideo transcript (use for context):\n${transcript.slice(0, 3000)}`;
  }
  if (prompt) {
    userPrompt += `\n\nVideo topic/prompt: ${prompt}`;
  }
  if (thumbnailGuidelines) {
    userPrompt += `\n\nBrand guidelines: ${thumbnailGuidelines}`;
  }
  if (!transcript && !prompt) {
    userPrompt += `\n\nVideo title for context: ${taskName}`;
  }

  const resp = await fetchWithRetry("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`AI title generation failed [${resp.status}]: ${errText.slice(0, 500)}`);
  }

  const data = await resp.json();
  const title = data.choices?.[0]?.message?.content?.trim();
  if (!title) {
    // Fallback to task name
    return taskName.slice(0, 40);
  }
  // Clean up any quotes the model might add
  return title.replace(/^["']|["']$/g, "").trim();
}

// ── Placid compositing ──────────────────────────────────────────────

async function uploadToPlacid(imageBase64DataUrl: string, PLACID_API_TOKEN: string): Promise<string> {
  // Extract the base64 data from the data URL
  const base64Data = imageBase64DataUrl.replace(/^data:image\/\w+;base64,/, "");
  const binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

  // Create a Blob for upload
  const blob = new Blob([binaryData], { type: "image/png" });
  const formData = new FormData();
  formData.append("file", blob, "thumbnail_base.png");

  const resp = await fetchWithRetry("https://api.placid.app/api/rest/media", {
    method: "POST",
    headers: {
      Authorization: PLACID_API_TOKEN,
    },
    body: formData,
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Placid media upload failed [${resp.status}]: ${errText.slice(0, 500)}`);
  }

  const data = await resp.json();
  return data.url || data.image_url || data.file_url;
}

async function placidComposite(
  placidMediaUrl: string,
  title: string,
  PLACID_API_TOKEN: string,
): Promise<string> {
  const resp = await fetchWithRetry(`https://api.placid.app/api/rest/${PLACID_TEMPLATE_UUID}`, {
    method: "POST",
    headers: {
      Authorization: PLACID_API_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      create_now: true,
      layers: {
        img: { image: placidMediaUrl },
        title: { text: title },
      },
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Placid composite failed [${resp.status}]: ${errText.slice(0, 500)}`);
  }

  const data = await resp.json();
  const resultUrl = data.image_url || data.url;
  if (!resultUrl) {
    throw new Error("Placid returned no image URL: " + JSON.stringify(data).slice(0, 500));
  }
  return resultUrl;
}

// ── Upload to Supabase Storage ──────────────────────────────────────

async function uploadToStorage(
  supabase: any,
  imageUrl: string,
  storagePath: string,
): Promise<string> {
  // Download the image
  const resp = await fetch(imageUrl);
  if (!resp.ok) {
    throw new Error(`Failed to download image for storage [${resp.status}]`);
  }
  const imageBlob = await resp.blob();
  const arrayBuffer = await imageBlob.arrayBuffer();

  const { error } = await supabase.storage
    .from("agent-assets")
    .upload(storagePath, new Uint8Array(arrayBuffer), {
      contentType: "image/png",
      upsert: true,
    });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  const { data: publicUrlData } = supabase.storage
    .from("agent-assets")
    .getPublicUrl(storagePath);

  return publicUrlData.publicUrl;
}

// ── Process a single queued run ──────────────────────────────────────

async function processRun(
  supabase: any,
  run: any,
  CLICKUP_API_TOKEN: string,
  LOVABLE_API_KEY: string,
  PLACID_API_TOKEN: string,
  SUPABASE_URL: string,
) {
  const runId = run.id;
  const taskId = run.input.task_id;

  console.log(`Processing thumbnail run ${runId} for task ${taskId}`);

  // Mark as running
  await supabase
    .from("workflow_runs")
    .update({ status: "running", started_at: new Date().toISOString(), error_message: null })
    .eq("id", runId);

  try {
    // ── Step 1: Fetch ClickUp task ──────────────────────────────────
    await logStep(supabase, runId, "fetch_clickup_task", "running", { taskId });

    const taskResp = await fetchWithRetry(`https://api.clickup.com/api/v2/task/${taskId}`, {
      headers: { Authorization: CLICKUP_API_TOKEN, "Content-Type": "application/json" },
    });
    if (!taskResp.ok) {
      const errText = await taskResp.text();
      throw new Error(`ClickUp task fetch failed [${taskResp.status}]: ${errText.slice(0, 500)}`);
    }
    const task = await taskResp.json();
    const taskName = task.name || "Untitled";
    const listId = task.list?.id;
    const customFields = task.custom_fields || [];

    await logStep(supabase, runId, "fetch_clickup_task", "success", null, {
      taskName,
      listId,
      fieldCount: customFields.length,
    });

    // ── Step 2: Resolve agent settings ──────────────────────────────
    await logStep(supabase, runId, "resolve_agent_settings", "running", { listId });

    if (!listId) throw new Error("Task has no list.id — cannot resolve agent");

    const { data: settings, error: settingsErr } = await supabase
      .from("agent_marketing_settings")
      .select("user_id, thumbnail_guidelines, headshot_url")
      .eq("clickup_video_deliverables_list_id", listId)
      .maybeSingle();

    if (settingsErr) throw new Error(`Settings query failed: ${settingsErr.message}`);
    if (!settings) throw new Error(`No agent_marketing_settings found for list id ${listId}`);

    const userId = settings.user_id;
    const thumbnailGuidelines = settings.thumbnail_guidelines;

    await logStep(supabase, runId, "resolve_agent_settings", "success", null, {
      userId,
      hasThumbnailGuidelines: !!thumbnailGuidelines,
    });

    // ── Step 3: Select reference image + background ─────────────────
    await logStep(supabase, runId, "select_assets", "running", { userId });

    // Reference image
    const { data: agentImages } = await supabase
      .from("agent_images")
      .select("image_url")
      .eq("user_id", userId);

    let referenceImageUrl: string | null = null;
    if (agentImages && agentImages.length > 0) {
      const randomIdx = Math.floor(Math.random() * agentImages.length);
      referenceImageUrl = agentImages[randomIdx].image_url;
    } else if (settings.headshot_url) {
      referenceImageUrl = settings.headshot_url;
    }

    if (!referenceImageUrl) {
      throw new Error("No reference images found for agent and no headshot_url configured");
    }

    // Background
    const { data: bgLinks } = await supabase
      .from("background_agent_links")
      .select("background_id")
      .eq("user_id", userId);

    let backgroundPrompt = "A clean, modern professional office with soft natural lighting and subtle depth of field";

    if (bgLinks && bgLinks.length > 0) {
      const randomBgLink = bgLinks[Math.floor(Math.random() * bgLinks.length)];
      const { data: bg } = await supabase
        .from("backgrounds")
        .select("prompt, name")
        .eq("id", randomBgLink.background_id)
        .maybeSingle();

      if (bg?.prompt) {
        backgroundPrompt = bg.prompt;
      }
    }

    await logStep(supabase, runId, "select_assets", "success", null, {
      referenceImageUrl: referenceImageUrl.slice(0, 100) + "...",
      backgroundPrompt: backgroundPrompt.slice(0, 100),
      totalImages: agentImages?.length || 0,
      totalBackgrounds: bgLinks?.length || 0,
    });

    // ── Step 4: Extract transcript + prompt from ClickUp fields ─────
    const transcript = getCustomFieldValue(customFields, "Video Transcription");
    const videoPrompt = getCustomFieldValue(customFields, "Prompt");

    // ── Step 5: Generate title ──────────────────────────────────────
    await logStep(supabase, runId, "generate_title", "running", {
      hasTranscript: !!transcript,
      hasPrompt: !!videoPrompt,
    });

    const title = await generateTitle(
      transcript,
      videoPrompt,
      thumbnailGuidelines,
      taskName,
      LOVABLE_API_KEY,
    );

    await logStep(supabase, runId, "generate_title", "success", null, { title });
    console.log(`Generated title for task ${taskId}: "${title}"`);

    // ── Step 6: Generate 9:16 base image ────────────────────────────
    await logStep(supabase, runId, "generate_image_9x16", "running");

    const base9x16 = await generateBaseImage(
      referenceImageUrl,
      backgroundPrompt,
      thumbnailGuidelines,
      "9:16",
      LOVABLE_API_KEY,
    );

    await logStep(supabase, runId, "generate_image_9x16", "success", null, {
      imageSize: base9x16.length,
    });

    // ── Step 7: Placid composite 9:16 ───────────────────────────────
    await logStep(supabase, runId, "placid_composite_9x16", "running");

    const placidMedia9x16 = await uploadToPlacid(base9x16, PLACID_API_TOKEN);
    const composited9x16Url = await placidComposite(placidMedia9x16, title, PLACID_API_TOKEN);

    await logStep(supabase, runId, "placid_composite_9x16", "success", null, {
      placidMediaUrl: placidMedia9x16,
      compositedUrl: composited9x16Url,
    });

    // ── Step 8: Generate 16:9 base image ────────────────────────────
    await logStep(supabase, runId, "generate_image_16x9", "running");

    const base16x9 = await generateBaseImage(
      referenceImageUrl,
      backgroundPrompt,
      thumbnailGuidelines,
      "16:9",
      LOVABLE_API_KEY,
    );

    await logStep(supabase, runId, "generate_image_16x9", "success", null, {
      imageSize: base16x9.length,
    });

    // ── Step 9: Placid composite 16:9 ───────────────────────────────
    await logStep(supabase, runId, "placid_composite_16x9", "running");

    const placidMedia16x9 = await uploadToPlacid(base16x9, PLACID_API_TOKEN);
    const composited16x9Url = await placidComposite(placidMedia16x9, title, PLACID_API_TOKEN);

    await logStep(supabase, runId, "placid_composite_16x9", "success", null, {
      placidMediaUrl: placidMedia16x9,
      compositedUrl: composited16x9Url,
    });

    // ── Step 10: Upload to Supabase Storage ─────────────────────────
    await logStep(supabase, runId, "upload_to_storage", "running");

    const storagePath9x16 = `thumbnails/${userId}/${taskId}/thumb_9x16.png`;
    const storagePath16x9 = `thumbnails/${userId}/${taskId}/thumb_16x9.png`;

    const publicUrl9x16 = await uploadToStorage(supabase, composited9x16Url, storagePath9x16);
    const publicUrl16x9 = await uploadToStorage(supabase, composited16x9Url, storagePath16x9);

    await logStep(supabase, runId, "upload_to_storage", "success", null, {
      url9x16: publicUrl9x16,
      url16x9: publicUrl16x9,
    });

    // ── Step 11: Update ClickUp ─────────────────────────────────────
    await logStep(supabase, runId, "update_clickup", "running");

    const clickupResults: Record<string, string> = {};

    // Set 16:9 URL to the custom field
    try {
      const fieldResp = await fetchWithRetry(
        `https://api.clickup.com/api/v2/task/${taskId}/field/${CLICKUP_THUMBNAIL_FIELD_ID}`,
        {
          method: "POST",
          headers: { Authorization: CLICKUP_API_TOKEN, "Content-Type": "application/json" },
          body: JSON.stringify({ value: publicUrl16x9 }),
        },
      );
      if (!fieldResp.ok) {
        const errText = await fieldResp.text();
        clickupResults["thumbnail_field"] = `error_${fieldResp.status}: ${errText.slice(0, 200)}`;
      } else {
        clickupResults["thumbnail_field"] = "success";
      }
    } catch (e: any) {
      clickupResults["thumbnail_field"] = `exception: ${e.message}`;
    }

    // Post comment with both URLs
    try {
      const commentText = `🖼️ **Thumbnails Generated**\n\n**Title:** ${title}\n\n**16:9 (Landscape):** ${publicUrl16x9}\n\n**9:16 (Portrait):** ${publicUrl9x16}`;
      const commentResp = await fetchWithRetry(
        `https://api.clickup.com/api/v2/task/${taskId}/comment`,
        {
          method: "POST",
          headers: { Authorization: CLICKUP_API_TOKEN, "Content-Type": "application/json" },
          body: JSON.stringify({ comment_text: commentText }),
        },
      );
      if (!commentResp.ok) {
        const errText = await commentResp.text();
        clickupResults["comment"] = `error_${commentResp.status}: ${errText.slice(0, 200)}`;
      } else {
        clickupResults["comment"] = "success";
      }
    } catch (e: any) {
      clickupResults["comment"] = `exception: ${e.message}`;
    }

    await logStep(supabase, runId, "update_clickup", "success", null, clickupResults);

    // ── Step 12: Mark run as success ────────────────────────────────
    await supabase
      .from("workflow_runs")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        output: {
          title,
          thumb_9x16_url: publicUrl9x16,
          thumb_16x9_url: publicUrl16x9,
          clickup_updates: clickupResults,
          task_name: taskName,
        },
      })
      .eq("id", runId);

    console.log(`Thumbnail run ${runId} completed successfully for task ${taskId}`);
  } catch (err: any) {
    console.error(`Thumbnail run ${runId} failed:`, err.message);
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
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
  const PLACID_API_TOKEN = Deno.env.get("PLACID_API_TOKEN")!;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    // ── 1. Claim queued runs ───────────────────────────────────────
    const { data: queuedRuns, error: fetchErr } = await supabase
      .from("workflow_runs")
      .select("*")
      .eq("workflow_name", "generate-thumbnail")
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(5);

    if (fetchErr) throw fetchErr;

    if (!queuedRuns || queuedRuns.length === 0) {
      console.log("No queued thumbnail runs to process");
      return new Response(JSON.stringify({ ok: true, processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${queuedRuns.length} queued thumbnail runs`);

    // ── 2. Process each run sequentially ───────────────────────────
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

      await processRun(supabase, run, CLICKUP_API_TOKEN, LOVABLE_API_KEY, PLACID_API_TOKEN, SUPABASE_URL);
      processed++;

      if (i < queuedRuns.length - 1) {
        console.log(`Waiting ${DELAY_BETWEEN_ITEMS_MS}ms before next item...`);
        await sleep(DELAY_BETWEEN_ITEMS_MS);
      }
    }

    // ── 3. Check if more items remain ──────────────────────────────
    const { count } = await supabase
      .from("workflow_runs")
      .select("id", { count: "exact", head: true })
      .eq("workflow_name", "generate-thumbnail")
      .eq("status", "queued");

    if (count && count > 0) {
      console.log(`${count} more queued thumbnail runs remaining, triggering self...`);
      await sleep(DELAY_BETWEEN_ITEMS_MS);
      fetch(`${SUPABASE_URL}/functions/v1/process-thumbnail-queue`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ trigger: "self-continuation" }),
      }).catch(() => {});
    }

    return new Response(
      JSON.stringify({ ok: true, processed, remaining: count || 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("process-thumbnail-queue error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
