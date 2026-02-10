

# New Webhook: Trigger Content Generation from ClickUp Checkbox

## Overview

Create a new edge function that receives ClickUp webhook events and triggers the `generate-social-copy` function when the "Generate Social Copy" checkbox custom field is checked on a task.

## How It Works

```text
[ClickUp: "Generate Social Copy" checkbox checked]
        |
        v  (webhook: taskUpdated event)
[clickup-generate-copy-webhook edge function]
        |
        +-- Verify signature
        +-- Fetch full task from ClickUp API
        +-- Check "Generate Social Copy" checkbox is true
        +-- Extract custom fields: Client ID, Shade Asset ID
        +-- Fetch transcript/description from task description or custom field
        +-- Call generate-social-copy (internal fetch to existing function)
        +-- Return result
```

## Implementation Details

### 1. New Edge Function: `clickup-generate-copy-webhook`

**File:** `supabase/functions/clickup-generate-copy-webhook/index.ts`

- Receives ClickUp webhook payloads (same signature verification as the scheduler)
- Fetches the full task via ClickUp API to read custom fields
- Checks the "Generate Social Copy" checkbox custom field -- only proceeds if it's checked (`true`)
- Extracts `Client ID (Supabase)` and `Shade Asset ID` from custom fields
- Uses the task description as the transcript/video description input
- Calls the existing `generate-social-copy` function via internal Supabase function invocation
- Logs the run to `workflow_runs` and `workflow_run_steps` for observability
- Idempotency: uses `generate-copy:{taskId}` as the idempotency key so re-checking the box doesn't regenerate

### 2. Update `register-social-webhook` to Register Both Webhooks

Add a second webhook registration for `taskUpdated` events pointing to:
```
{SUPABASE_URL}/functions/v1/clickup-generate-copy-webhook
```

Or optionally accept a `type` parameter (`"schedule"` or `"generate"`) so you can register them independently.

### 3. Config Update

Add to `supabase/config.toml`:
```toml
[functions.clickup-generate-copy-webhook]
verify_jwt = false
```

### Key Design Decisions

- **Separate function** (not merged into the scheduler) -- keeps concerns clean: one function generates copy, another schedules posts
- **Checkbox detection**: ClickUp `taskUpdated` webhooks include the event but not always the specific field that changed. The function fetches the full task and reads the checkbox value. If it's `false`/unchecked, the function skips silently.
- **Transcript source**: Uses the ClickUp task description as the video transcript/description. If a dedicated "Transcript" custom field exists, it can be read from there instead.
- **Re-generation**: If copy already exists for this task (idempotency check in `generate-social-copy`), the function returns the existing result without regenerating. To force regeneration, the existing result would need to be deleted first.

### Files Created/Modified

1. **New:** `supabase/functions/clickup-generate-copy-webhook/index.ts`
2. **Modified:** `supabase/functions/register-social-webhook/index.ts` -- add second webhook registration for `taskUpdated` pointing to the new function
3. **Modified:** `supabase/config.toml` -- add new function entry

