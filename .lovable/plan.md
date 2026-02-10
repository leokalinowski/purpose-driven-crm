

# Fix: Idempotency and Re-queue Logic for Generate-Copy Workflow

## Problem
- Each ClickUp webhook trigger includes a unique `auto_id`, creating a **new idempotency key per trigger** -- this causes duplicate `workflow_runs` entries for the same task (e.g., task `868hdxjg7` has 3+ runs)
- Old runs from before the queue system are marked `"success"` even though transcripts were never fetched
- When the same task is re-triggered, the webhook correctly blocks it (idempotency), but this also blocks legitimate re-processing
- Result: tasks never get re-queued through the new queue system

## Solution

### 1. Change idempotency to task-level (not auto_id-level)

In `clickup-generate-copy-webhook/index.ts`, change the idempotency key from:
```
generate-copy:{taskId}:{autoId}
```
to simply:
```
generate-copy:{taskId}
```

This ensures **one workflow run per ClickUp task**, not one per webhook trigger.

### 2. Allow re-queuing when transcript was missing

Update the idempotency check: instead of blocking on any `"success"` status, check if the previous run actually completed with a transcript. If the output doesn't show `Video Transcription: "success"` in `clickup_updates`, allow re-queuing by resetting the run to `"queued"`.

Logic:
- If existing run status is `"success"` AND output has `clickup_updates.Video Transcription === "success"` --> block (truly complete)
- If existing run status is `"success"` but no transcript update --> reset to `"queued"` (needs re-processing)
- If existing run status is `"queued"` or `"running"` --> block (already in progress)
- If existing run status is `"failed"` or `"skipped"` --> reset to `"queued"` (retry)

### 3. Clean up duplicate runs

Run a one-time SQL cleanup to remove the duplicate `workflow_runs` entries, keeping only the most recent run per task_id. This prevents the queue processor from re-processing the same task multiple times.

### 4. Update `process-copy-queue` re-check logic

In `process-copy-queue/index.ts`, update the status re-check (before processing each item) to also verify the run hasn't been superseded by a newer run for the same task.

## Files Changed

### `supabase/functions/clickup-generate-copy-webhook/index.ts`
- Simplify idempotency key to `generate-copy:{taskId}`
- Update the duplicate check to allow re-queuing when transcript was missing
- When re-queuing, update the existing run's `input` with fresh data and reset status to `"queued"`

### `supabase/functions/process-copy-queue/index.ts`
- No major changes needed -- it already processes `"queued"` items correctly

### One-time SQL cleanup
- Delete duplicate `workflow_runs` rows, keeping only the latest per task
- Reset the kept rows to `"queued"` so they get re-processed through the new queue with proper transcript fetching
