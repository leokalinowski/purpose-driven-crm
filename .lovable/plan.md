

## Changes Needed

Two adjustments based on your feedback:

### 1. Restore Support Hub access for all tiers

Change `/support` back from `'managed'` to `'core'` in `useFeatureAccess.ts` (line 33). The Support page already has working UI — it just needs the gate lowered back to Core so all paying users can access it.

**File:** `src/hooks/useFeatureAccess.ts` — change `'/support': 'managed'` to `'/support': 'core'`

### 2. Keep the webhook delay — but make it non-blocking

The 30-second delay is fine conceptually, but the issue is that `await`-ing it blocks the webhook response to Stripe. Stripe times out at ~30s and retries, which could cause duplicate user creation and emails.

The fix is simple: **fire the coaching email without awaiting** so the webhook returns `200` to Stripe immediately, while the coaching email sends in the background after the delay.

**File:** `supabase/functions/stripe-webhook/index.ts`

Replace the `await new Promise(...)` + `await fetch(...)` block (lines 285-340) with a non-awaited wrapper:

```typescript
// Fire-and-forget: send coaching email after 2 minutes without blocking the webhook response
setTimeout(async () => {
  try {
    const coachingRes = await fetch("https://api.resend.com/emails", { ... });
    // existing coaching email logic
  } catch (err) {
    console.log("[STRIPE-WEBHOOK] ERROR sending delayed coaching email", err);
  }
}, 120_000); // 2 minutes
```

This way:
- The webhook responds to Stripe in under 1 second (no retries, no duplicates)
- The coaching email still sends 2 minutes later
- You can increase the delay to whatever you want

### Summary

| # | File | Change |
|---|---|---|
| 1 | `src/hooks/useFeatureAccess.ts` | Change `/support` from `'managed'` back to `'core'` |
| 2 | `supabase/functions/stripe-webhook/index.ts` | Make coaching email fire-and-forget with 2-minute `setTimeout` (no `await`) |

