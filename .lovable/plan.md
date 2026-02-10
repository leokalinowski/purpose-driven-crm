
Goal
- Replace Make.com Scenarios 02 and 03 with reliable, observable, idempotent Supabase Edge Functions + minimal admin UI so the Shade → ClickUp → AI generation loop becomes “bulletproof” (retries, dedupe, tracking, and clear failure surfaces).

What I learned from your blueprints (ground truth)
- Scenario 02 (“Files Uploaded to Shade - Approval Tasks”)
  - Trigger: webhook “SM Videos Ready for Review”
  - Calls Shade: POST https://api.shade.inc/v1/search/files with:
    - drive_id = "434a697c-9f1f-43e5-b9db-93e02a28bd5a"
    - path = "/{drive_id}/{agent_profile.shade_folder_id}"
    - recursive = true
  - Iterates each returned file
  - Creates ClickUp tasks (list = agent_profile.clickup_video_deliverables_list_id)
  - Writes multiple custom fields including:
    - “Client ID (Supabase)” style identifier (agent_profile.id)
    - file path, file name, transcription_id, shade file id

- Scenario 03 (“Video Approved (Content Generation)”)
  - Trigger: ClickUp automation webhook when a custom field indicates approval
  - Fetches ClickUp task
  - Looks up agent marketing settings in Supabase table agent_marketing_settings by id = custom field “Client ID (Supabase)”
  - Fetches transcript from Shade:
    - GET https://api.shade.inc/assets/{Shade Asset ID}/transcription/file?drive_id={drive_id}&type=txt
  - Uses LLM to generate:
    - Social caption (module id 4)
    - YouTube titles (module id 9) prompt visible in blueprint
    - YouTube description (module id 12) referenced by ClickUp update but prompt not clearly visible; we can replicate with a consistent “SEO description from transcript” prompt
  - Moves file in Shade:
    - POST https://api.shade.inc/files/move
    - source: "/{drive_id}/02 processed/{File Name}"
    - destination: "/{drive_id}/03 approved/{File Name}"
  - Updates ClickUp task custom fields with generated copy/titles/description (and sets/updates the file path field)

Key reliability problems we’ll solve (the “bulletproof” part)
- Duplicate webhooks and replays (ClickUp and any upstream triggers)
- Partial failures (AI succeeds but ClickUp update fails, etc.)
- External API transient errors (429/5xx/timeouts)
- No centralized run history / no clear “where did it fail?”
- IDs spread across systems without a canonical tracking record

Architecture (high level)
- Edge functions as the single integration orchestrator (ClickUp, Shade, AI, Supabase).
- A small “workflow runs” database layer to:
  - dedupe (idempotency keys + unique constraints)
  - track progress and errors (run/step logs)
  - allow manual re-run (admin UI button / function endpoint)

Proposed database additions (Test env first; publish after validation)
1) workflow_runs
- id (uuid)
- workflow_name (text) e.g. "shade_approval_tasks", "clickup_content_generation"
- idempotency_key (text, unique per workflow_name)
- status (text) "queued" | "running" | "succeeded" | "failed"
- started_at, finished_at (timestamptz)
- triggered_by (text) "webhook" | "admin_ui" | "manual"
- input (jsonb) sanitized payload snapshot
- output (jsonb) summary output
- error_message (text)
- error_details (jsonb)

2) workflow_run_steps
- id (uuid)
- run_id (uuid, fk)
- step_name (text) e.g. "shade.search_files", "clickup.create_task", "ai.generate_social_copy"
- status (text)
- started_at, finished_at
- attempt (int)
- request (jsonb) sanitized
- response_status (int)
- response_body (jsonb/text truncated)
- error_message (text)

3) social_shade_clickup_links (for scenario 02 dedupe)
- id (uuid)
- agent_marketing_settings_id (uuid/text matching existing agent_marketing_settings.id)
- shade_file_id (text) OR shade_asset_id (text) depending on what Shade returns in /search/files
- shade_path (text)
- file_name (text)
- transcription_id (text, nullable)
- clickup_task_id (text, nullable)
- created_at, updated_at
- Unique constraint on (agent_marketing_settings_id, shade_file_id) so tasks are created once.

4) content_generation_results (for scenario 03 dedupe + re-run)
- id (uuid)
- clickup_task_id (text, unique)
- agent_marketing_settings_id (uuid/text)
- shade_asset_id (text)
- transcript_hash (text) (optional but helpful)
- social_copy (text)
- youtube_titles (text)
- youtube_description (text)
- generated_at (timestamptz)
- status (text) succeeded/failed
- error_message (text)

RLS approach for these tables
- These are operational logs. Keep them admin-only:
  - Enable RLS.
  - Policies: only admins can select/insert/update.
  - Edge functions will use service role for inserts/updates.
- If you want agents to see their own run history later, we can add additional policies keyed by agent/user_id.

Secrets and configuration (must-do before implementation)
We already have:
- CLICKUP_API_TOKEN (good; ClickUp requires it without “Bearer”)
We need to add:
- SHADE_API_KEY (you confirmed we need this)
Recommended to add:
- SHADE_BASE_URL (default https://api.shade.inc) as optional config
- SHADE_DRIVE_ID (since it’s hardcoded in Make as 434a…; better as config)
- CLICKUP_WEBHOOK_SECRET (optional but strongly recommended to validate ClickUp signatures; current clickup-webhook already supports this pattern)

Edge Functions to implement
A) social-shade-approval-tasks (Scenario 02 replacement)
Purpose
- For a given agent (agent_marketing_settings_id or user_id), list Shade files under that agent’s Shade folder and create ClickUp “approval request” tasks for any new files.

Endpoint / invocation
- POST /functions/v1/social-shade-approval-tasks
- verify_jwt = true for admin UI manual runs (best first step for reliability)
- Later, we can add a webhook mode (verify_jwt=false + signature) if you want Shade or another system to call it directly.

Inputs
- agent_user_id OR agent_marketing_settings_id
- optional: dry_run boolean (returns what would be created without writing)
- optional: limit / pagination cursor

Flow
1) Resolve agent marketing settings from Supabase (shade_folder_id, clickup_video_deliverables_list_id).
2) Shade: search/list files in folder via POST /v1/search/files.
3) For each file:
   - Compute idempotency key = agent_marketing_settings_id + shade_file_id.
   - Upsert into social_shade_clickup_links; if already exists with clickup_task_id, skip.
   - Create ClickUp task in the correct list with:
     - Name: “Approval Request {file.name} for {agentName}”
     - Description includes path/id/drive_id/transcription_id if available
     - Custom fields: set “Client ID (Supabase)”, “File Name”, “Shade Asset ID / File ID”, “File Path”, “Transcription ID”
   - Save clickup_task_id back to social_shade_clickup_links.
4) Create a workflow_run record + step logs (including failures per file).

Reliability mechanics
- Per external call: timeout + retry with exponential backoff on 429/5xx.
- Per file: isolate errors so 1 bad file doesn’t abort the full run; aggregate results.

B) clickup-social-video-approved (Scenario 03 replacement)
Purpose
- Receive ClickUp webhook for “video approved” and run: fetch transcript → generate copy/titles/description → move Shade file → update ClickUp task fields.

Endpoint / invocation
- POST /functions/v1/clickup-social-video-approved
- verify_jwt = false (because ClickUp won’t send a Supabase JWT)
- Validate ClickUp signature using CLICKUP_WEBHOOK_SECRET (same verification approach as existing clickup-webhook).

Inputs
- Raw ClickUp webhook payload. We’ll extract task_id robustly.

Flow
1) Parse webhook, extract task_id.
2) Idempotency gate:
   - Create workflow_run with idempotency_key = “clickup:{task_id}:{event_timestamp_or_history_id}”.
   - If already processed successfully, return 200 OK immediately.
3) Fetch full ClickUp task details (ClickUp API).
4) Extract custom fields by NAME (not hardcoded IDs) for robustness:
   - “Client ID (Supabase)”
   - “Shade Asset ID”
   - “File Name”
   - (Optionally) any “Approved?” field so we ensure it truly is approved.
5) Load agent_marketing_settings from Supabase by id (as Make does).
6) Shade: fetch transcript text from /assets/{assetId}/transcription/file (with drive_id + type=txt).
7) AI generation (replace Make’s ChatGPT)
   - Implement a dedicated Edge Function wrapper call to Lovable AI Gateway (recommended) so you do not depend on Make/ChatGPT connections:
     - Model default: google/gemini-3-flash-preview (fast + capable).
     - Prompts live server-side only.
   - Generate:
     - Social caption (use your exact prompt from module 4)
     - YouTube titles (use your exact prompt from module 9)
     - YouTube description (we’ll implement a consistent prompt: SEO-friendly description, no invented facts, include chapters only if transcript supports it, etc.)
   - Save outputs to content_generation_results (upsert by clickup_task_id).
8) Shade move file:
   - POST /files/move with computed source/destination from drive + file name
   - If move fails but AI succeeded, we still update ClickUp and mark step failure, then admin can re-run “move only” later.
9) ClickUp update task custom fields:
   - We will update by locating fields by name in the task’s custom_fields array (we can get the field IDs directly from the task payload).
   - Set:
     - Social copy field
     - YouTube titles field
     - YouTube description field
     - File path field updated to “/03 approved/{File Name}” (instead of writing the raw Shade response)
10) Mark workflow_run succeeded/failed.

Reliability mechanics
- Webhook handler always returns 200 for “already processed” or “accepted”.
- Full run is tracked with steps; failures have a clear reason and can be replayed.
- Retries on external APIs; AI gateway errors (402/429) surfaced clearly in logs and ClickUp can be updated with a “generation failed” message field if you want.

C) Optional: social-automation-admin (manual replay + diagnostics)
Purpose
- A small admin-only UI in the app:
  - “Run Scenario 02 for agent” button
  - “View recent runs” table
  - “Retry failed run” / “Retry step” actions (e.g., just redo ClickUp update, just redo Shade move)
- This is what makes it operationally bulletproof (you won’t be guessing what happened).

Frontend additions
- New Admin page (or new tab inside existing Admin Social Media Management) that shows:
  - workflow_runs list with filters (workflow, status, agent)
  - run detail view (steps, error messages, payload summaries)
  - action buttons to invoke edge functions with admin JWT

Consistency / modernization tasks (important, based on what’s already in your repo)
- Several existing edge functions still use older import patterns (deno.land serve + esm.sh supabase). We will standardize new functions on:
  - Deno.serve()
  - npm:@supabase/supabase-js@2 (except known exceptions like Resend)
  - Shared CORS headers in supabase/functions/_shared/cors.ts
  - Consistent error envelopes: { success: false, error: "...", details?: ... }
- This prevents the “Failed to send a request to the Edge Function” class of failures you’ve been seeing.

ClickUp custom fields mapping strategy (how we avoid brittle IDs)
- Read:
  - Always match by field.name (e.g., “Client ID (Supabase)”) to locate values.
- Write:
  - Use the field.id from the task’s custom_fields to update the right ones.
  - If a field is missing, log a clear error in workflow_run_steps and optionally comment on the ClickUp task (future enhancement).

Implementation sequencing (so you get value quickly)
Phase 1: Infrastructure + secrets
1) Add required secrets: SHADE_API_KEY, SHADE_DRIVE_ID, CLICKUP_WEBHOOK_SECRET (recommended).
2) Add the workflow tables + RLS admin-only policies.

Phase 2: Scenario 02 replacement (manual admin-run first)
3) Implement social-shade-approval-tasks edge function.
4) Add a minimal Admin UI button to run it for a selected agent and show the summary (created/skipped/failed counts).

Phase 3: Scenario 03 replacement (ClickUp webhook)
5) Implement clickup-social-video-approved webhook edge function with signature verification + idempotency.
6) Implement AI generation using Lovable AI gateway (server-side prompts).
7) Implement Shade move + ClickUp custom fields update.
8) Add workflow run logs + an admin “Run history” view.

Phase 4: Hardening + runbooks
9) Add per-step retry endpoints (admin-only) to replay failures without rerunning everything.
10) Add alerting surfaces:
   - show toast/notification in Admin UI when a run fails
   - optional: email admin via existing email infra

What I still need from you (to implement correctly)
- Shade credentials:
  - SHADE_API_KEY value
  - Confirm the drive_id should be the same for all agents (currently 434a…).
- ClickUp fields:
  - Confirm the exact ClickUp custom field names you care about (the plan assumes we match by name).
  - If any are different per list, we’ll still match by name per task.
- Approval trigger:
  - Confirm which ClickUp event type you’re using (task updated) and which field indicates “approved” so we only run generation when that field is set.

Definition of done (acceptance tests)
- Scenario 02:
  - Trigger from admin UI for a chosen agent creates exactly one ClickUp task per new Shade file.
  - Re-running does not create duplicates.
- Scenario 03:
  - When ClickUp approval automation fires, the function:
    - generates content
    - moves Shade file to approved folder
    - writes outputs into ClickUp fields
  - Replayed webhooks do not regenerate or duplicate updates.
- Admin UI:
  - You can see each run, where it failed, and retry it.

Notes on Scenario 04 (not implemented in this pass)
- We’ll handle scheduling after review next by extending this same pattern:
  - “approved & reviewed” field in ClickUp triggers a webhook
  - create/update social_posts records in Supabase
  - call existing social-schedule edge function (Postiz) in a controlled, idempotent way
  - full run history retained

Links to existing code we’ll align with
- clickup-webhook: already includes signature verification helper; we’ll reuse the approach but modernize patterns in the new functions.
- agent_marketing_settings: already stores clickup list IDs and shade folder ID; we’ll leverage it as the source of truth.

