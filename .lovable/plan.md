

## Problem

The `stripe-webhook` edge function is failing on **every** incoming event with:
> `SubtleCryptoProvider cannot be used in a synchronous context. Use constructEventAsync(...) instead of constructEvent(...)`

The source code already uses `constructEventAsync`, but the **deployed** version is stale and still uses the synchronous method. Stripe is retrying the webhook repeatedly (12+ attempts visible in logs), all failing.

Meanwhile, `check-subscription` is now working correctly after the earlier fix.

## Plan

### 1. Redeploy the `stripe-webhook` edge function
The code at `supabase/functions/stripe-webhook/index.ts` (line 30) already has the correct `await stripe.webhooks.constructEventAsync(...)` call. It simply needs to be redeployed so the live version matches.

### 2. Add explicit Stripe crypto provider (safety measure)
To ensure compatibility with the Deno/Edge runtime, add the `SubtleCryptoProvider` import and pass it to `constructEventAsync`:

```typescript
import { Stripe } from "https://esm.sh/stripe@18.5.0";

// In the verification block:
const cryptoProvider = Stripe.createSubtleCryptoProvider();
event = await stripe.webhooks.constructEventAsync(
  body, signature!, webhookSecret, undefined, cryptoProvider
);
```

This explicitly tells Stripe to use the Web Crypto API, which is required in Deno/Edge environments.

### 3. Verify via logs
After redeployment, the queued Stripe retries should succeed automatically. Check logs to confirm `checkout.session.completed` processes and the user account + role provisioning triggers.

## Expected outcome
- Webhook processes the test subscription event
- User account is created (or matched) and role assigned
- Password-set email is sent via Resend

