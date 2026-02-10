
# Scenario 05: "Ready to Schedule" - Migration Plan

## What This Scenario Does

When a reviewed video is marked "Ready to Schedule" in ClickUp (via custom field/automation), it:
1. Fetches the ClickUp task details
2. Looks up the agent's profile and marketing settings in Supabase
3. Reads the "Publish Date" custom field from the ClickUp task
4. Downloads the video file URL from Shade
5. Normalizes the video URL through Metricool's API
6. Schedules the post across all connected platforms (Facebook, Instagram, LinkedIn, Threads, YouTube) via Metricool's scheduler API

## Key Discovery: Metricool (not Postiz)

The existing `social-schedule` edge function uses **Postiz** for scheduling. However, this Make scenario uses **Metricool** directly. We will replicate the Make behavior and use Metricool, since that is what is actually connected to the agents' social accounts.

## ClickUp Custom Fields Used

From the blueprint:
- **"Client ID (Supabase)"** - maps to `profiles.id`
- **"Shade Asset ID"** - used to download video from Shade
- **"Publish Date"** - unix timestamp (ms) for when to schedule the post

## Data Flow

```text
ClickUp webhook (task_id)
  |
  v
Fetch ClickUp task --> extract custom fields
  |
  v
Supabase: profiles (by Client ID) --> agent_marketing_settings (by user_id)
  |
  v
Shade: GET /assets/{asset_id}/download --> video download URL
  |
  v
Metricool: normalize video URL --> normalized media URL
  |
  v
Metricool: POST /v2/scheduler/posts --> schedule across all platforms
```

## Edge Function: `clickup-social-ready-to-schedule`

### Configuration
- `verify_jwt = false` (ClickUp webhook cannot send JWTs)
- Validates ClickUp webhook signature via `CLICKUP_WEBHOOK_SECRET`

### Flow (step by step)

1. **Parse webhook payload**, extract `task_id`
2. **Idempotency check**: Insert into `workflow_runs` with key `schedule:{task_id}:{event_id}`. If already succeeded, return 200 immediately
3. **Fetch ClickUp task** via API (uses `CLICKUP_API_TOKEN`)
4. **Extract custom fields by name**:
   - "Client ID (Supabase)" -- the profile ID
   - "Shade Asset ID" -- for video download
   - "Publish Date" -- unix ms timestamp
5. **Query Supabase**: `profiles` by id, then `agent_marketing_settings` by `user_id`
6. **Shade download URL**: `GET https://api.shade.inc/assets/{assetId}/download?drive_id={SHADE_DRIVE_ID}&origin_type=SOURCE&asset_id={assetId}` -- returns a URL to the video file
7. **Metricool normalize**: `GET /actions/normalize/image/url?url={encodedShadeUrl}&userId=4142885&blogId={metricool_brand_id}` -- returns a Metricool-ready media URL
8. **Metricool schedule**: `POST /v2/scheduler/posts` with the full payload:
   - `autoPublish: true`, `draft: false`
   - `publicationDate` from the ClickUp "Publish Date" field (formatted as `YYYY-MM-DDTHH:mm:ss`, timezone `America/New_York`)
   - `media: [normalizedUrl]`
   - `providers` array built from `metricool_facebook_id`, `metricool_instagram_id`, `metricool_linkedin_id`, `metricool_threads_id`, `metricool_youtube_id`
   - Platform-specific data: Instagram as REEL, YouTube as short (public), etc.
   - `text: ""` (empty -- the social copy is not included in the scheduling payload per the blueprint)
9. **Log result** to `workflow_runs` / `workflow_run_steps`
10. **Return 200** with summary

### Reliability Mechanics
- Same patterns as Scenarios 02/03: idempotency keys, per-step logging, retry with backoff on 429/5xx
- If Shade download succeeds but Metricool fails, the step is logged and can be retried from admin UI
- If Metricool normalize succeeds but scheduling fails, same pattern

## Secrets Needed

Already configured:
- `CLICKUP_API_TOKEN`
- `CLICKUP_WEBHOOK_SECRET`
- `SHADE_API_KEY`
- `SHADE_DRIVE_ID`

Need to verify/add:
- **Metricool API credentials** -- The Make scenario uses a Metricool connection. We need the Metricool API key as a Supabase secret. The existing `metricool-proxy` edge function does not use an API key (it is a URL proxy). We will need a `METRICOOL_API_KEY` secret and possibly a `METRICOOL_USER_ID` (hardcoded as `4142885` in the blueprint).

## Database Changes

No new tables needed -- this scenario reuses the `workflow_runs` and `workflow_run_steps` tables already created in Phase 1. Optionally, we could log scheduled post records to the existing `social_posts` table for tracking.

## Admin UI Addition

Add a "Schedule" workflow type to the existing workflow admin dashboard (being built for Scenarios 02/03), so admins can:
- See scheduling runs and their status
- Retry failed scheduling attempts
- Manually trigger scheduling for a specific ClickUp task

## Implementation Sequence

1. Add `METRICOOL_API_KEY` and `METRICOOL_USER_ID` secrets
2. Create `clickup-social-ready-to-schedule` edge function with full flow
3. Add `verify_jwt = false` config entry
4. Integrate into the workflow admin UI (already being built)
5. Register the ClickUp webhook URL for the "Ready to Schedule" automation

## Open Questions

Before implementing, I need you to confirm:
- **Metricool API Key**: Do you have a Metricool API key we can add as a secret? (The Make scenario uses a connection called "My Metricool API Key connection")
- **Metricool User ID**: The blueprint hardcodes `userId=4142885`. Is this the same for all agents, or should it come from config?
- **Social copy text**: The blueprint sends `text: ""` (empty). Is the social copy added separately later, or should we pull it from the ClickUp task / `content_generation_results` table?
- **YouTube title**: The blueprint references `{{youtubeTitle}}` in the YouTube data. Where does this come from? Should we pull it from `content_generation_results` (generated in Scenario 03)?
