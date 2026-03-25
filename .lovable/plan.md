

## Fix Hub Post-Payment Issues

Three problems identified from the screenshot and code:

### Problem 1: Password email not received by new user
The `stripe-webhook` sends a welcome/password-set email via Resend. Looking at the screenshot, the "Your Core Plan is Now Active" email was sent from `noreply@news.realestateonpurpose.com` with sender name "Real Estate on Purpose - Market Report". This means:
- The `RESEND_API_KEY` is scoped to the `news.realestateonpurpose.com` domain
- The `RESEND_FROM_EMAIL` env var is likely set to `noreply@news.realestateonpurpose.com`
- The `RESEND_FROM_NAME` env var is likely set to `Real Estate on Purpose - Market Report`

Since the user was detected as an **existing user** (they got the "Plan Active" email, not the "Set Your Password" email), the password-set flow was skipped entirely. The user already existed in Supabase but never set a password — this is the root cause of them not receiving a password email.

**Fix in `stripe-webhook`:** After sending the existing-user confirmation email, also check if the user has **never signed in** (no `last_sign_in_at`), and if so, generate and send a recovery/password-set link just like for new users.

### Problem 2: Wrong "From" name on emails
The `stripe-webhook` uses `RESEND_FROM_NAME` which is set to "Real Estate on Purpose - Market Report" (used for newsletters). 

**Fix:** Hardcode the from name for subscription emails to `"Real Estate on Purpose"` instead of using the `RESEND_FROM_NAME` env var. Also use `noreply@hub.realestateonpurpose.com` as the from address for account/subscription emails (separate from newsletter domain).

### Problem 3: Support link requires login
The confirmation email links to `hub.realestateonpurpose.com/support` which requires authentication.

**Fix:** Replace the support link with a direct contact method — either Pam's email or a public-facing support page/form URL.

### Problem 4: Redirect to welcome page after checkout
Currently, Stripe redirects to `/pricing?checkout=success` which shows a success view. The user wants a dedicated `/welcome` page instead.

**Fix:** 
1. Create a new `/welcome` page with the success content (currently shown inline on Pricing)
2. Update `create-checkout` to redirect to `/welcome` instead of `/pricing?checkout=success`
3. Keep the page simple — user said they'll edit the content

### Changes

**File 1: `supabase/functions/stripe-webhook/index.ts`**
- Hardcode from name to `"Real Estate on Purpose"` for subscription emails (not `RESEND_FROM_NAME`)
- For existing users: check `last_sign_in_at` — if null, also send a password-set email
- Replace support link with direct email (`pam@realestateonpurpose.com` or similar public contact)

**File 2: `supabase/functions/create-checkout/index.ts`**
- Change `success_url` from `/pricing?checkout=success` to `/welcome?checkout=success`

**File 3: `src/pages/Welcome.tsx`** (new)
- Standalone welcome page (no sidebar, like Pricing)
- Shows REOP logo, success message, "check your email" notice for unauthenticated users, and sign-in button
- Simple and clean — user will customize content later

**File 4: `src/App.tsx`**
- Add route for `/welcome` pointing to the new Welcome page

**File 5: `src/pages/Pricing.tsx`**
- Keep the `?checkout=success` handling as a fallback, but redirect to `/welcome` if detected
