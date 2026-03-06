

## Issues Found

1. **`check-subscription` edge function not deployed** — The code has `test_mode` in the response but the live function isn't returning it. Needs redeployment.

2. **Existing test subscription uses old price IDs** — Your current subscription (`price_1T86YHQGA8aVyaHSFtMtQNJp` / `prod_U6JA9VSIQQg4lc`) predates the new test catalog, so `getTierFromPriceId` returns `null`. You would need to cancel this old subscription and create a new one using the new test prices to verify the full flow.

## Fix Plan

### Step 1: Redeploy all three edge functions
- `check-subscription`
- `create-checkout`
- `stripe-webhook`

### Step 2: Cancel the old test subscription
The old subscription with `price_1T86YHQGA8aVyaHSFtMtQNJp` won't map to any tier. Cancel it via Stripe dashboard or API.

### Step 3: Test with a new checkout
Go to the pricing page, select a plan, complete checkout with test card `4242 4242 4242 4242`. This will create a subscription with the new test price IDs, and the webhook will correctly assign the tier via metadata.

### Step 4: Verify end-to-end
After checkout, confirm:
- `check-subscription` returns `test_mode: true` and the correct `price_id`
- `useSubscription` resolves the correct tier (`core` or `managed`)
- The pricing page shows the correct "Current Plan" badge

