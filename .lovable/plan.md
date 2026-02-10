
# Fix: ClickUp Automation Payload Parsing

## Problem

When you click "Generate Social Copy" in ClickUp, the Automation sends a webhook with this structure:

```text
{
  "auto_id": "...",
  "trigger_id": "...",
  "payload": {
    "id": "868hdxjj1",    <-- task ID is here
    "name": "Approval Request ...",
    ...
  }
}
```

But both webhook functions look for the task ID at:
- `payload.task_id` (not present)
- `payload.task.id` (not present)

So they log **"No task_id in payload, skipping"** and do nothing.

## Fix

Update the task ID extraction line in **both** webhook functions to also check `payload.payload.id` (the ClickUp Automation format):

### File 1: `supabase/functions/clickup-generate-copy-webhook/index.ts` (line 145)

```
// BEFORE
const taskId = payload?.task_id || payload?.task?.id;

// AFTER
const taskId = payload?.task_id || payload?.task?.id || payload?.payload?.id;
```

### File 2: `supabase/functions/clickup-social-ready-to-schedule/index.ts` (line 174)

```
// BEFORE
const taskId = payload?.task_id || payload?.task?.id;

// AFTER
const taskId = payload?.task_id || payload?.task?.id || payload?.payload?.id;
```

## Deployment

Redeploy both `clickup-generate-copy-webhook` and `clickup-social-ready-to-schedule`.
