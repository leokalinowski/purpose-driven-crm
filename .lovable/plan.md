

# Thumbnail Generation Pipeline with Placid

## Overview

Implement a ClickUp-triggered thumbnail generation pipeline running in Supabase Edge Functions. It will use the Lovable AI gateway for image generation (Gemini 2.5 Flash Image) and Placid for deterministic text overlay compositing, then write results back to ClickUp.

## How It Works (Step by Step)

1. A ClickUp automation sends a webhook when a task is ready for thumbnails
2. Our webhook function validates the request and adds it to a processing queue
3. The queue processor picks up the job and:
   - Fetches the ClickUp task details
   - Looks up the agent's branding settings, reference photos, and background prompts from the database
   - Generates a short title using AI (based on transcript, prompt, and thumbnail guidelines)
   - Generates a base image using Gemini AI (agent's face + selected background)
   - Uploads the AI image to Placid and composites the title text using the "Thumbnail Default" template -- this ensures perfect, pixel-accurate text every time
   - Repeats the process for a second aspect ratio (landscape 16:9)
   - Writes both thumbnail URLs back to ClickUp

## New Secret Required

You will need to provide your **Placid API Token**. You can find it in your Placid dashboard under API settings. I will ask you for this before starting implementation.

## Technical Details

### New Files

**`supabase/functions/clickup-generate-thumbnail-webhook/index.ts`**
- Accepts POST from ClickUp automation
- Verifies ClickUp webhook signature
- Extracts task ID from payload
- Task-level idempotency: key = `generate-thumbnail:{taskId}`
- Re-queue logic (same pattern as copy webhook):
  - queued/running: skip (already processing)
  - success: always allow re-queue (thumbnails may be regenerated on demand)
  - failed/skipped: re-queue
- Inserts/updates `workflow_runs` with `workflow_name = "generate-thumbnail"`, `status = "queued"`
- Fire-and-forget call to `process-thumbnail-queue`

**`supabase/functions/process-thumbnail-queue/index.ts`**
Sequential queue processor (same architecture as `process-copy-queue`):

Step 1 -- Fetch ClickUp task:
- GET `https://api.clickup.com/api/v2/task/{taskId}`
- Extract `task.name`, `task.list.id`, `task.custom_fields`

Step 2 -- Resolve agent settings:
- Query `agent_marketing_settings` where `clickup_video_deliverables_list_id = task.list.id`
- Extract `user_id`, `thumbnail_guidelines`

Step 3 -- Select reference image and background:
- Query `agent_images` where `user_id = settings.user_id`, pick random
- Query `background_agent_links` where `user_id = settings.user_id`, then fetch the matching `backgrounds` row, pick random
- Fallback: if no images found, use `headshot_url` from settings; if no backgrounds, use a default professional prompt

Step 4 -- Generate title (LLM text):
- Call Lovable AI gateway with a text model
- Prompt mirrors the Make blueprint exactly:
  - Inputs: transcript (from ClickUp "Video Transcription" field, optional), prompt (from ClickUp "Prompt" field), thumbnail_guidelines
  - Rules: 3-8 words, no clickbait, no ALL CAPS, confident/calm tone
  - Output: 1 title, no commentary

Step 5 -- Generate 9:16 base image:
- Download the selected reference image
- Call Lovable AI gateway with `google/gemini-2.5-flash-image`
- Prompt mirrors the Make blueprint exactly:
  - Preserve subject identity/facial likeness
  - Replace background using selected background prompt
  - No people/text/logos in background
  - Portrait 9:16, extreme detail, sharp focus
  - Apply thumbnail_guidelines as guardrails

Step 6 -- Placid composite (9:16):
- Upload the generated image to Placid via `POST https://api.placid.app/api/rest/media`
- Create final thumbnail via `POST https://api.placid.app/api/rest/{template_uuid}` using template `nlhaoglryb9fg` ("Thumbnail Default")
- Layer mappings from the blueprint:
  - `img` layer: the uploaded Placid media URL
  - `title` layer: the generated title text
- Poll or use `create_now: true` to get the result synchronously
- Store the resulting Placid image URL

Step 7 -- Generate 16:9 base image:
- Same Gemini call but with landscape 16:9 aspect ratio instruction
- Same Placid composite process with the same template and title

Step 8 -- Upload to Supabase Storage:
- Download both Placid result images
- Upload to `agent-assets` bucket at paths:
  - `thumbnails/{user_id}/{task_id}/thumb_9x16.png`
  - `thumbnails/{user_id}/{task_id}/thumb_16x9.png`
- Use `upsert: true` so regeneration overwrites

Step 9 -- Update ClickUp:
- Set custom field `d1d4739b-5009-4cac-b8ec-a1e16de2be05` to the 16:9 Supabase Storage URL
- Post a task comment with both URLs and the generated title

Step 10 -- Mark run complete:
- `workflow_runs.status = "success"` with output containing both URLs, title, and ClickUp update results

### Config Changes

**`supabase/config.toml`** -- Add:
```
[functions.clickup-generate-thumbnail-webhook]
verify_jwt = false

[functions.process-thumbnail-queue]
verify_jwt = false
```

### Existing Secrets Used
- `CLICKUP_API_TOKEN` -- ClickUp API calls
- `CLICKUP_WEBHOOK_SECRET` -- webhook signature verification
- `LOVABLE_API_KEY` -- Lovable AI gateway for Gemini image generation and title generation
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` -- database and storage access

### New Secret Required
- `PLACID_API_TOKEN` -- Placid REST API authentication

### No Database Migrations Needed
Reuses existing tables: `workflow_runs`, `workflow_run_steps`, `agent_marketing_settings`, `agent_images`, `backgrounds`, `background_agent_links`

### Error Handling
- Each step is logged to `workflow_run_steps` with status, timing, and error details
- If Gemini image generation fails: mark run as failed with clear error
- If Placid compositing fails: mark run as failed (image was generated but text overlay failed)
- If no agent settings found: fail with descriptive message
- If no reference images found: fallback to headshot_url, then fail if also missing
- `fetchWithRetry` for all external API calls (ClickUp, Gemini, Placid) to handle rate limits and transient errors

