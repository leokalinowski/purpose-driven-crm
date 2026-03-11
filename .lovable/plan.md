

## Plan: Switch Webhook Tier Detection from Price IDs to Product IDs

### Problem
The current `stripe-webhook` uses a `PRICE_TO_TIER_LIVE` / `PRICE_TO_TIER_TEST` map with 6 price IDs per environment. Every time you add a new price (e.g., a new billing interval or promo), you'd need to update this map. Product IDs are more stable — one product = one tier, regardless of how many prices it has.

### Products → Tiers

From Stripe:
| Tier | Product IDs (Live) | Product IDs (Test) |
|------|---|---|
| Core | `prod_U6CZnBRXAi2jey` (monthly), `prod_U6CanelVG5Ilvn` (annual), `prod_U6Ex7tgKBZtZc5` (founder) | `prod_U6Jwx4nLCE1I2s`, `prod_U6JxCNA2455QJe`, `prod_U6Jx3oB19agtnz` |
| Managed | `prod_U6CbXJqnPWpRVp` (monthly), `prod_U6CctQ78FSyxvp` (annual), `prod_U6Eyw4OBAEIm9V` (founder) | `prod_U6JxoQJVRqucDT`, `prod_U6JyhK7qt3CK4K`, `prod_U6JydMsJcVubkF` |

### Changes

**File: `supabase/functions/stripe-webhook/index.ts`**

1. Replace `PRICE_TO_TIER_LIVE` and `PRICE_TO_TIER_TEST` maps with `PRODUCT_TO_TIER_LIVE` and `PRODUCT_TO_TIER_TEST` maps using product IDs instead of price IDs.

2. Replace `getTierFromPriceId()` with `getTierFromProductId()`.

3. In the `checkout.session.completed` handler, after retrieving the subscription, get the product ID from `subscription.items.data[0].price.product` and use that for tier detection instead of the price ID.

4. Redeploy the edge function.

This means any new price you create under an existing product will automatically be recognized — no code changes needed.

