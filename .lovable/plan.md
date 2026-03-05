

## Plan: Stripe Integration for Subscription Billing

This plan connects Stripe to the Hub so you can charge new clients for Core ($149/mo) and Managed ($449/mo) plans, with optional annual pricing at a discount.

### Architecture Overview

```text
┌─────────────────────────────────────────────────┐
│  Stripe Dashboard                                │
│  Products: Core ($149/mo, $1,490/yr)             │
│            Managed ($449/mo, $4,490/yr)           │
│  Webhook → stripe-webhook edge function          │
└──────────────┬──────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────┐
│  Edge Functions                                   │
│  1. create-checkout-session (creates Stripe       │
│     Checkout for a given price)                   │
│  2. create-customer-portal (billing management)   │
│  3. stripe-webhook (subscription lifecycle →      │
│     updates user_roles + subscriptions table)     │
└──────────────┬──────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────┐
│  Supabase Tables                                  │
│  - subscriptions (stripe_customer_id,             │
│    stripe_subscription_id, status, plan, ...)     │
│  - user_roles (updated on webhook events)         │
└─────────────────────────────────────────────────┘
```

### Step 1: Enable Stripe

Use the Lovable Stripe tool to connect your Stripe account and store the secret key.

### Step 2: Create Stripe Products & Prices

Create 4 prices in Stripe:
- **Core Monthly**: $149/month
- **Core Annual**: $1,490/year (2 months free)
- **Managed Monthly**: $449/month
- **Managed Annual**: $4,490/year (2 months free)

### Step 3: Database — `subscriptions` table

| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | |
| user_id | uuid FK → auth.users | The subscriber |
| stripe_customer_id | text | Stripe customer ID |
| stripe_subscription_id | text | Stripe subscription ID |
| plan | text | 'core' or 'managed' |
| billing_interval | text | 'monthly' or 'annual' |
| status | text | 'active', 'past_due', 'canceled', 'trialing' |
| current_period_end | timestamptz | When current billing period ends |
| created_at / updated_at | timestamptz | |

RLS: Users can read their own row. Admins can read all.

### Step 4: Edge Functions

**`create-checkout-session`** — Called from the pricing page. Accepts `priceId` and `userId`. Creates a Stripe Checkout Session with `success_url` and `cancel_url`. Returns the checkout URL.

**`create-customer-portal`** — Called from Settings. Looks up the user's `stripe_customer_id` from the `subscriptions` table and creates a Stripe Billing Portal session.

**`stripe-webhook`** — Listens for:
- `checkout.session.completed` → Creates `subscriptions` row, updates `user_roles` to the purchased plan ('core' or 'managed')
- `customer.subscription.updated` → Updates status, plan changes
- `customer.subscription.deleted` → Sets status to 'canceled', downgrades `user_roles` to 'core' or removes access
- `invoice.payment_failed` → Sets status to 'past_due'

### Step 5: Pricing Page (`/pricing`)

A public-facing page (accessible without auth) showing the two plans with monthly/annual toggle. Each plan card has a "Get Started" button that:
1. If not logged in → redirects to `/auth?redirect=/pricing`
2. If logged in → calls `create-checkout-session` edge function → redirects to Stripe Checkout

### Step 6: Success Page (`/checkout/success`)

After successful payment, Stripe redirects here. Shows confirmation and redirects to the dashboard.

### Step 7: Settings — Subscription Tab

Add a "Subscription" tab to the Settings page showing:
- Current plan and billing interval
- Next billing date
- "Manage Billing" button → calls `create-customer-portal` → redirects to Stripe portal

### Step 8: Auth Flow Update

After signup, redirect to `/pricing` instead of `/` so new users must subscribe before accessing the platform. The existing `useFeatureAccess` hook already gates routes by role — once the webhook sets the `user_roles` entry to 'core' or 'managed', access unlocks automatically.

### Step 9: Signup Flow Modification

Currently, signup requires an invitation code. The flow becomes:
1. User signs up (with invite code) → account created with no active subscription
2. Redirected to `/pricing` → selects plan → completes Stripe Checkout
3. Webhook fires → `subscriptions` row created, `user_roles` updated
4. User redirected to dashboard with full access

### Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/functions/create-checkout-session/index.ts` | Create |
| `supabase/functions/create-customer-portal/index.ts` | Create |
| `supabase/functions/stripe-webhook/index.ts` | Create |
| `src/pages/Pricing.tsx` | Create |
| `src/pages/CheckoutSuccess.tsx` | Create |
| `src/pages/Settings.tsx` | Modify — add Subscription tab |
| `src/App.tsx` | Modify — add routes |
| `src/hooks/useSubscription.ts` | Create — fetch user's subscription data |
| `src/hooks/useAuth.tsx` | Modify — redirect new signups to /pricing |
| Migration | Create `subscriptions` table with RLS |
| Secrets | `STRIPE_SECRET_KEY` (via Stripe enable tool), `STRIPE_WEBHOOK_SECRET` |

### Stripe Webhook Setup

After deploying `stripe-webhook`, you'll need to register the webhook URL in the Stripe Dashboard:
- URL: `https://cguoaokqwgqvzkqqezcq.supabase.co/functions/v1/stripe-webhook`
- Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`

