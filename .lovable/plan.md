

## Enable Promotion Code Field on Stripe Checkout

The missing coupon field is a Stripe Checkout session configuration. By default, Stripe hides the promotion code input. We need to add `allow_promotion_codes: true` to the checkout session creation in the `create-checkout` edge function.

### Changes

**File: `supabase/functions/create-checkout/index.ts`**

Add `allow_promotion_codes: true` to both the founder plan and standard plan `stripe.checkout.sessions.create()` calls. This adds a "Add promotion code" link on the Stripe Checkout page where you can enter your 100% off coupon.

Two locations to update:
1. Founder plan session (~line 128): add `allow_promotion_codes: true` to `sessionParams`
2. Standard plan session (~line 160): add `allow_promotion_codes: true` to `sessionParams`

### Pre-requisite

You'll also need a promotion code created in Stripe. I can create a 100% off coupon for you using the Stripe tools after implementing this change.

