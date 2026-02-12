


# Thumbnail Generation Pipeline with Placid

## Overview

Implement a ClickUp-triggered thumbnail generation pipeline running in Supabase Edge Functions. It will use the Lovable AI gateway for image generation (Gemini 2.5 Flash Image) and Placid for deterministic text overlay compositing, then write results back to ClickUp.

## Status: ✅ IMPLEMENTED

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

## Implementation Files

- `supabase/functions/clickup-generate-thumbnail-webhook/index.ts` — Webhook entry point
- `supabase/functions/process-thumbnail-queue/index.ts` — Queue processor
- `supabase/config.toml` — Updated with both functions (verify_jwt = false)

## Secrets Used

- `CLICKUP_API_TOKEN` — ClickUp API calls
- `CLICKUP_WEBHOOK_SECRET` — webhook signature verification
- `LOVABLE_API_KEY` — Lovable AI gateway for Gemini image generation and title generation
- `PLACID_API_TOKEN` — Placid REST API authentication
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — database and storage access

## Placid Template

- Template UUID: `nlhaoglryb9fg` ("Thumbnail Default")
- Layers: `img` (background image), `title` (text overlay)

## ClickUp Integration

- Thumbnail field ID: `d1d4739b-5009-4cac-b8ec-a1e16de2be05` (receives 16:9 URL)
- Comment posted with both 9:16 and 16:9 URLs + generated title

## Testing

To test end-to-end:
1. Point a ClickUp automation to: `https://cguoaokqwgqvzkqqezcq.supabase.co/functions/v1/clickup-generate-thumbnail-webhook`
2. Trigger on a task in a list that has `agent_marketing_settings.clickup_video_deliverables_list_id` configured
3. Check `workflow_runs` table for status and `workflow_run_steps` for detailed logs
4. Verify thumbnails appear in `agent-assets` storage bucket under `thumbnails/`
