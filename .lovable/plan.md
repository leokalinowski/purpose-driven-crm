

## Plan: "Pay First" Flow for Core/Managed Users

### Summary

Core and Managed users will never need an invitation. They visit `/pricing` (publicly accessible, no auth required), pick a plan, and go through Stripe Checkout. After payment, the `stripe-webhook` automatically creates their Supabase account and emails them a password-set link. The existing `/auth` page keeps its invitation-based signup for Agents/Admins only.

### Architecture

```text
Visitor → /pricing → Pick plan → Stripe Checkout (collects email + payment)
                                        ↓
                              Stripe webhook fires
                                        ↓
                        stripe-webhook edge function:
                          1. Creates Supabase user via admin API
                          2. Creates profile row
                          3. Assigns 'core' or 'managed' role
                          4. Sends password-set email via Supabase
                          5. Handles founder schedule (existing logic)
                                        ↓
                        User gets email → sets password → signs in → dashboard
```

### Changes Required

#### 1. Make `/pricing` work without authentication

**File: `src/pages/Pricing.tsx`**
- Remove the `if (!user)` guard on the checkout button
- Allow unauthenticated visitors to click "Get Core" / "Get Managed"
- For unauthenticated users, call a new `create-checkout` flow that does NOT require a Bearer token (email collected by Stripe Checkout itself)
- Remove `<Layout>` wrapper for unauthenticated visitors (show a standalone pricing page)

#### 2. Update `create-checkout` edge function

**File: `supabase/functions/create-checkout/index.ts`**
- Support two modes:
  - **Authenticated mode** (existing): user is logged in, use their email
  - **Unauthenticated mode** (new): no auth header; let Stripe Checkout collect the email
- For unauthenticated mode, skip the auth check and do NOT set `customer_email`
- Always include `subscription_data.metadata` with `tier` (and `founder`/`monthly_price_id` for founder plans)
- For unauthenticated checkouts, pass `tier` in `subscription_data.metadata` so the webhook knows the role to assign

#### 3. Update `stripe-webhook` to auto-create accounts

**File: `supabase/functions/stripe-webhook/index.ts`**
- In the `checkout.session.completed` handler:
  - Extract `customer_email` from the Stripe session (Stripe provides it)
  - Check if a Supabase user with that email already exists
  - If NOT: create the user via `supabase.auth.admin.createUser()` with a random password and `email_confirm: true`
  - Create the `profiles` row with data from the Stripe session
  - Assign the `core` or `managed` role in `user_roles`
  - Send a password-reset email via `supabase.auth.admin.generateLink({ type: 'recovery', email })` so the user can set their password
  - If user ALREADY exists: just upsert the role (existing behavior)
- Also add `subscription_data.metadata` fix for standard (non-founder) plans so cancellation works

#### 4. Bypass `validate_invited_signup` for webhook-created users

**Database migration**
- Update the `validate_invited_signup()` trigger function to allow signups where the email matches a Stripe customer with an active subscription, OR where the caller is the service role (which is how `admin.createUser` works — it bypasses triggers by default since it uses the admin API, so this may not be needed; will verify)
- Note: `supabase.auth.admin.createUser()` bypasses auth triggers entirely, so no migration should be needed

#### 5. Update `/auth` page — label signup as "Agent Invitation"

**File: `src/pages/Auth.tsx`**
- Rename the "Sign Up" tab to "Agent Sign Up" or add a subtitle "For invited agents only"
- Add a callout/link: "Looking to subscribe? Visit our Pricing page"
- Keep all existing invitation logic unchanged

#### 6. Update `Index.tsx` — handle `?checkout=success`

**File: `src/pages/Index.tsx`**
- Detect `?checkout=success` in URL params
- Show a success banner: "Your subscription is active! Check your email to set your password."
- For authenticated users returning from checkout, trigger an immediate `checkSubscription()` refresh

#### 7. Remove invitation requirement from `handle_new_user` for paid users

The `handle_new_user()` trigger checks for invitations. Since `admin.createUser()` bypasses auth triggers, this should not fire. But as a safety measure, we should verify this behavior during testing.

### Files Modified

| File | Change |
|------|--------|
| `src/pages/Pricing.tsx` | Allow unauthenticated checkout, standalone layout |
| `supabase/functions/create-checkout/index.ts` | Support unauthenticated mode, always set metadata |
| `supabase/functions/stripe-webhook/index.ts` | Auto-create user, send password-set email, fix metadata bug |
| `src/pages/Auth.tsx` | Label signup as agent-only, add pricing link |
| `src/pages/Index.tsx` | Handle `?checkout=success` param |
| `src/hooks/useSubscription.ts` | Support unauthenticated `createCheckout` calls |

### Security Considerations

- The `create-checkout` function in unauthenticated mode only creates a Stripe Checkout session -- no Supabase access is granted until the webhook confirms payment
- Account creation happens server-side in the webhook using `SUPABASE_SERVICE_ROLE_KEY`, which is never exposed to the client
- The password-set email ensures only the legitimate email owner can access the account
- The `validate_invited_signup` trigger is not involved since `admin.createUser()` bypasses it

