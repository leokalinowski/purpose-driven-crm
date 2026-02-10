

# Fix: Make clickup-generate-copy-webhook Work with ClickUp Automations

## The Problem

The edge function was built expecting an **API-registered webhook** format (with HMAC signature headers). But you're using a **ClickUp Automation** (the webhook action shown in your screenshot), which:

1. Does **not** send an `x-signature` or `x-clickup-signature` header -- so signature verification always fails ("Invalid ClickUp signature" in logs)
2. Sends task data as **flat fields** (e.g., `{ "task_id": "abc123", "task_name": "My Task", ... }`) instead of a nested event payload

## Changes Required

### File: `supabase/functions/clickup-generate-copy-webhook/index.ts`

**Change 1: Skip signature verification for Automation webhooks**

The function currently rejects requests when `CLICKUP_WEBHOOK_SECRET` is configured but no valid signature is present. Since Automations don't sign payloads, the function should skip verification when no signature header is provided (instead of rejecting).

Replace the signature check logic:
- If no signature header is present AND no webhook secret is configured: allow (current behavior)
- If no signature header is present BUT webhook secret IS configured: **allow anyway** (new -- Automations don't sign)
- If signature header IS present: verify it (for API-registered webhooks)

In practice, simplify `verifySignature` to return `true` when `headerSig` is null (meaning it's an Automation, not an API webhook).

**Change 2: Handle the flat Automation payload**

The current code reads `payload?.task_id || payload?.task?.id`. This already handles both formats, so the `task_id` extraction should work fine. No change needed here.

**Change 3: The checkbox check still works**

The function fetches the full task from the ClickUp API regardless of the payload format, so the checkbox verification and field extraction remain correct.

### Summary of Code Change

In the `verifySignature` function, change:
```typescript
// BEFORE: rejects when secret exists but no signature
if (!headerSig) return false;

// AFTER: skip verification if no signature header (Automation webhook)
if (!headerSig) return true;
```

This is a one-line change. The rest of the function logic (fetching the task, checking the checkbox, calling generate-social-copy) all works correctly since it fetches the full task from the ClickUp API regardless of what's in the webhook payload.

### Security Note

This makes the endpoint open to unauthenticated calls. For production hardening, you could add a simple shared secret as a URL parameter or custom header in the ClickUp Automation configuration (e.g., `?secret=my-secret`). But for now, the function is safe because it only generates content -- it doesn't delete or modify external data.

