
# Fix: Ready-to-Schedule Webhook for ClickUp Automations

## Problem
Identical to the generate-copy webhook — the `clickup-social-ready-to-schedule` function rejects requests when no signature header is present, but ClickUp Automations don't send signature headers.

## Change

**File:** `supabase/functions/clickup-social-ready-to-schedule/index.ts` (line 21)

```typescript
// BEFORE
if (!headerSig) return false;

// AFTER
if (!headerSig) return true;
```

This is the exact same one-line fix applied to the generate-copy webhook. The function will then proceed to fetch the full task from the ClickUp API and verify the status is "Ready to Schedule" before doing anything, so it remains safe.

## Deployment
Redeploy `clickup-social-ready-to-schedule` after the change.
