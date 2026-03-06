

## Plan: Dual-Mode Stripe Configuration (Test + Live)

The approach is to keep all existing live IDs untouched and add a test-mode layer that activates based on whether the Stripe secret key is a test key (`sk_test_`) or live key (`sk_live_`).

### How It Works

The `STRIPE_SECRET_KEY` already in Supabase secrets determines which mode you're in. When it starts with `sk_test_`, the system uses test IDs. When it starts with `sk_live_`, it uses the current production IDs. No ID replacement needed.

### Changes

#### 1. `src/config/stripe.ts` -- Add test IDs alongside live IDs

Add a parallel `STRIPE_TIERS_TEST` config with the new test product/price IDs. Export a helper `getStripeTiers(isTestMode: boolean)` that returns the correct set. The existing `STRIPE_TIERS` export stays unchanged for production.

On the frontend, detect test mode via a simple check: the `check-subscription` response will include a `test_mode` flag (see step 3).

#### 2. `supabase/functions/create-checkout/index.ts` -- Auto-select IDs based on key type

At the top, detect `const isTestMode = stripeKey.startsWith("sk_test_")`. Maintain two maps for `FOUNDER_PLANS` and `STANDARD_PRICE_TIERS` -- one for test, one for live -- and select the correct one based on `isTestMode`. The rest of the logic stays identical. This means no live IDs are touched.

#### 3. `supabase/functions/check-subscription/index.ts` -- Return test_mode flag

Add `test_mode: stripeKey.startsWith("sk_test_")` to the JSON response so the frontend knows which tier config to use for mapping `price_id` to tier name.

#### 4. `supabase/functions/stripe-webhook/index.ts` -- Auto-select price-to-tier map

Same pattern: detect test vs live key, use the correct price-to-tier lookup map when `metadata.tier` is missing. Add a fallback that derives tier from the subscription's price ID using the appropriate map.

#### 5. `src/hooks/useSubscription.ts` -- Pass test_mode to tier lookup

Store the `test_mode` flag from the check-subscription response and pass it to `getTierFromPriceId` so it uses the correct ID set.

### Summary of Test IDs (no replacement, additive only)

| Plan | Test Price ID |
|------|--------------|
| Core Monthly | `price_1T87J0QGA8aVyaHS7vCe7Fw8` |
| Core Annual | `price_1T87JNQGA8aVyaHS0fReVKmL` |
| Core Founder | `price_1T87JeQGA8aVyaHSYcaEONPJ` |
| Managed Monthly | `price_1T87JzQGA8aVyaHSBCJ7pzWT` |
| Managed Annual | `price_1T87KUQGA8aVyaHSnpM40Lh3` |
| Managed Founder | `price_1T87KlQGA8aVyaHSN5VInftx` |

### Testing Flow

1. With `sk_test_` key (current state): pricing page uses test IDs, checkout creates test subscriptions, webhook assigns roles correctly.
2. When ready for production: swap `STRIPE_SECRET_KEY` to `sk_live_` -- everything automatically uses the existing live IDs with zero code changes.

