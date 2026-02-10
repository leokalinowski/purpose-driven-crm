

# Queue System for Generate-Copy Webhook + Require Transcript

## Overview
Instead of processing each webhook immediately (which overwhelms Shade when multiple tasks fire at once), the webhook will **enqueue** tasks into the database and a separate **processor function** will work through them one at a time with delays between Shade API calls. Additionally, copy generation will be **skipped entirely** if a transcript cannot be retrieved.

## Architecture

The current flow is:
```text
ClickUp Webhook --> clickup-generate-copy-webhook --> Shade API + AI generation (all inline)
```

The new flow will be:
```text
ClickUp Webhook --> clickup-generate-copy-webhook (enqueue only, fast response)
                          |
                          v
                   workflow_runs table (status = "queued")
                          |
                          v
               process-copy-queue (new function, called via cron or self-invoked)
                   - Picks up oldest "queued" run
                   - Fetches transcript from Shade (with delays)
                   - If no transcript: marks as "skipped", does NOT generate copy
                   - If transcript found: calls generate-social-copy, updates ClickUp
                   - Processes next item (with 3s delay between items)
```

## Changes

### 1. Modify `clickup-generate-copy-webhook/index.ts`
- **Keep**: Signature verification, payload parsing, idempotency check, ClickUp task fetch, checkbox check, field extraction, and Shade ID parsing
- **Remove**: The actual Shade fetch, AI generation call, and ClickUp field update logic (steps 5c through 7)
- **Add**: Save all extracted data (task details, shadeAssetId, shadeDriveId, clientId) into the `workflow_runs.input` field with status `"queued"`
- **Return immediately** with `{ ok: true, queued: true }` -- this keeps ClickUp happy and prevents timeouts

### 2. Create new `process-copy-queue/index.ts`
This function processes queued items one at a time:

- Query `workflow_runs` for the oldest rows where `workflow_name = 'generate-copy'` and `status = 'queued'`, limit 10
- For each queued run (sequentially, with a 3-second delay between items):
  1. Mark status as `"running"`
  2. Fetch transcript from Shade API using the stored `shadeAssetId` and `shadeDriveId`
  3. **If transcript fetch fails or returns empty**: mark as `"skipped"` with reason `"no_transcript"` -- do NOT call AI generation
  4. **If transcript succeeds**: call `generate-social-copy`, then update ClickUp fields (Generated Copy, YT Title, YT Description, Video Transcription)
  5. Mark as `"success"` or `"failed"`
- After processing all items, if there are more queued items remaining, invoke itself to continue processing

### 3. Set up a cron job
Schedule `process-copy-queue` to run every 2 minutes as a safety net. This ensures queued items get processed even if the self-invocation fails. The function is idempotent (it picks up `queued` items and marks them `running` first), so overlapping cron triggers won't cause duplicates.

### 4. Transcript-required rule
In the new processor, after the Shade API call:
- If `transcript` is empty or the fetch failed, the run is marked `"skipped"` with a clear error message: `"Transcript not available - copy generation requires a transcript"`
- The AI generation and ClickUp field updates are completely skipped
- This ensures your team never gets AI-generated copy that wasn't based on actual video content

## Technical Details

### `clickup-generate-copy-webhook/index.ts` changes
- Steps 1-5b remain the same (verify, parse, idempotency, fetch task, checkbox, extract fields, parse Shade IDs)
- Steps 5c-7 are removed
- New: Store enriched input in `workflow_runs`:
  ```
  input: {
    task_id, task_name, clickup_task_data (custom_fields),
    shade_asset_id, shade_drive_id, client_id
  }
  status: "queued"
  ```

### `process-copy-queue/index.ts` structure
- Accepts POST (from cron or self-invocation)
- Fetches up to 10 queued runs ordered by `created_at ASC`
- Uses `UPDATE ... SET status = 'running' WHERE status = 'queued'` to claim items (prevents double-processing)
- 3-second delay between processing each item to respect Shade rate limits
- Logs every step to `workflow_run_steps` for full observability
- Self-invokes if more items remain after processing the batch

### Cron schedule (via pg_cron)
```sql
SELECT cron.schedule(
  'process-copy-queue-every-2min',
  '*/2 * * * *',
  $$ SELECT net.http_post(...) $$
);
```

### No database migration needed
The `workflow_runs` table already has `status`, `input` (jsonb), and all needed columns. The `"queued"` status is already the default value.

