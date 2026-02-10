
# Fix: Allow Regeneration of Social Copy

## Problem
The idempotency check uses `generate-copy:{taskId}` as the key. Once a task succeeds, clicking "Generate Social Copy" again is blocked with "Already generated copy for this task." This prevents regeneration after fixes or when the user wants fresh output.

## Solution
Change the idempotency key to include the ClickUp Automation's unique trigger instance ID (`auto_id`), which is different each time the automation fires. This way:
- Each automation trigger gets its own run (allows regeneration)
- The same webhook delivery retried by ClickUp is still deduplicated (same `auto_id`)

## Technical Changes

### File: `supabase/functions/clickup-generate-copy-webhook/index.ts`

Update the idempotency key construction (around line 133):

```
// BEFORE
const idempotencyKey = `generate-copy:${taskId}`;

// AFTER
const autoId = payload?.auto_id || "";
const idempotencyKey = autoId
  ? `generate-copy:${taskId}:${autoId}`
  : `generate-copy:${taskId}`;
```

This ensures:
- Each time the user triggers the ClickUp Automation, a new `auto_id` is generated, so it gets a fresh run
- If ClickUp retries the same webhook delivery (same `auto_id`), it is still deduplicated
- Backward compatible: if `auto_id` is missing, falls back to task-only key

### Immediate Fix
After deploying, the existing successful run for task `868hdxjj1` won't block the next trigger because the next automation will have a new `auto_id`.

### No other files change

### Deployment
Redeploy `clickup-generate-copy-webhook`.
