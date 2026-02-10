
# Fetch Transcript from Shade Before Generating Copy

## Problem
The task description contains metadata (Path, ID, Drive ID, Transcription ID) -- not the actual transcript text. The AI is generating copy based on the task name instead of the real video dialogue.

## Solution
Add a new step in `clickup-generate-copy-webhook` to fetch the transcript from the Shade API before calling `generate-social-copy`.

## How It Works

1. **Parse the task description** to extract the Shade Asset ID and Drive ID from the `text_content` field (format: `ID: {uuid}\nDrive ID: {uuid}`)
2. **Call the Shade API** to get the transcript utterances:
   ```
   GET https://api.shade.inc/assets/{asset_id}/transcription/utterances?drive_id={drive_id}
   Authorization: Bearer {SHADE_API_KEY}
   ```
3. **Concatenate the utterances** into a single transcript string
4. **Pass the transcript** to `generate-social-copy` instead of the raw task description

## Technical Changes

### File: `supabase/functions/clickup-generate-copy-webhook/index.ts`

**Add `SHADE_API_KEY` and `SHADE_DRIVE_ID` environment variables** (already configured as secrets).

**New step between "extract_fields" and "call_generate_social_copy":**

- Parse `text_content` from the task description using regex to extract:
  - `ID:` line as the Shade Asset ID
  - `Drive ID:` line (fallback to the `SHADE_DRIVE_ID` env var)
- Call `GET /assets/{asset_id}/transcription/utterances?drive_id={drive_id}` with `Authorization: Bearer {SHADE_API_KEY}`
- Extract and join the utterance text into a single transcript string
- If the Shade fetch fails (no transcription available, API error), fall back to the task name as `video_description` (current behavior, but logged as a warning)

**Update the generate payload** to use the fetched transcript instead of `task.description`.

**Update the custom field Video Transcription in the original ClickUp Task.

### No other files change
The `generate-social-copy` function already accepts a `transcript` parameter and uses it correctly.

### Deployment
Redeploy `clickup-generate-copy-webhook`.
