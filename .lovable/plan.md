

## Plan: Stripe Subscription Integration

### Step 1: Enable Stripe
Use the Stripe enable tool to connect your Stripe account and store the secret key. This will unlock additional Stripe tools (product/price creation, etc.) and provide detailed implementation guidance.

### Step 2: After Stripe is enabled
Once enabled, we'll get access to Stripe-specific tools and docs. Then we'll implement:

1. **Database** — `subscriptions` table tracking `stripe_customer_id`, `stripe_subscription_id`, `plan`, `status`, `billing_interval`, `current_period_end`
2. **Edge Functions**:
   - `create-checkout-session` — creates Stripe Checkout for a given price
   - `create-customer-portal` — billing management via Stripe portal
   - `stripe-webhook` — syncs lifecycle events → updates `subscriptions` + `user_roles`
3. **Frontend**:
   - `/pricing` page with monthly/annual toggle (Core $149/mo, Managed $449/mo)
   - `/checkout/success` confirmation page
   - Subscription tab in Settings
   - Auth flow redirect to `/pricing` for new signups

### Why start with enabling Stripe first
The enable tool will reveal what additional tools are available (e.g., creating products/prices directly). This determines the exact implementation steps, so there's no point planning further detail until we see what's unlocked.

**Next step: I'll enable Stripe, which will prompt you for your Stripe secret key.**

