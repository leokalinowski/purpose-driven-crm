

## Plan: Add Founder Plans (6-Month Introductory Pricing)

### Overview
Add two limited "Founder Plan" options that charge a discounted 6-month rate upfront, then automatically switch to regular monthly billing. Uses Stripe Subscription Schedules to handle the two-phase pricing.

### Step 1: Create Stripe Products/Prices
Create 2 new Stripe prices (6-month recurring interval):
- **Core Founder**: $997 every 6 months (`interval: month`, `interval_count: 6`)
- **Managed Founder**: $2,997 every 6 months (`interval: month`, `interval_count: 6`)

These prices are only used for the initial phase of the subscription schedule.

### Step 2: Update `src/config/stripe.ts`
Add a `founder` billing option to each tier alongside `monthly` and `annual`:
```
core.founder = { price_id: '<new>', amount: 997 }
managed.founder = { price_id: '<new>', amount: 2997 }
```
Update `getTierFromPriceId` to recognize the new price IDs as `core`/`managed`.

### Step 3: Modify `create-checkout` Edge Function
When the incoming `priceId` matches a founder price, instead of creating a simple checkout session, create one using **Subscription Schedules**:
- Phase 1 (iterations: 1): Use the 6-month founder price
- Phase 2 (ongoing): Switch to the regular monthly price ($149/$449)

This is done via `subscription_data.subscription_schedule` in the Checkout Session, or by creating the schedule after checkout via webhook. The simplest approach: use `checkout.sessions.create` with `mode: 'subscription'` for Phase 1, then attach a schedule update via the `stripe-webhook` or a post-checkout hook.

**Simpler alternative**: Use `checkout.sessions.create` normally with the 6-month price. Then in the `check-subscription` function or a new post-checkout edge function, create a Subscription Schedule that transitions to monthly after the first period ends.

### Step 4: Update Pricing Page UI
- Add a third billing toggle option or a separate "Founder Plans" section with a badge like "Limited - First 50 Only"
- Show the founder pricing: "$997 for 6 months, then $149/mo" and "$2,997 for 6 months, then $449/mo"
- Style with urgency (limited availability badge)

### Step 5: Update `check-subscription`
Ensure the function recognizes founder price IDs and maps them to the correct tier (`core` or `managed`).

### Files Changed
- `src/config/stripe.ts` - Add founder price entries
- `src/pages/Pricing.tsx` - Add Founder Plans section/toggle
- `supabase/functions/create-checkout/index.ts` - Handle subscription schedule for founder prices
- `supabase/functions/check-subscription/index.ts` - Recognize founder price IDs

