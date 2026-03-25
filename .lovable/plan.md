## Diagnosis: Bobby Brown's Core Plan — No Account Created

### What Happened

1. Bobby Brown paid for the Core plan on Stripe (one of the two customers: `cus_UD6xHVjHdgC89m` or `cus_U6MFUycgiCrF5T`)
2. The `stripe-webhook` edge function has **zero logs** — meaning it either never received the webhook event from Stripe, or it crashed before logging anything
3. Bobby Brown does **not exist** in `auth.users`, `profiles`, or `user_roles` — no account was ever provisioned
4. No email was logged in `email_logs` for Bobby either

### Root Cause

The `stripe-webhook` function never processed the checkout event. Most likely causes:

- **The webhook endpoint URL in Stripe is not pointing to the deployed function** — or it was never registered
- **The function wasn't deployed** at the time of the payment
- **The webhook secret mismatch** caused a silent 400 rejection (though we'd still expect boot logs)

### Immediate Fix Plan (Bobby Brown)

Since no account exists, we need to manually provision Bobby's account. This requires:

1. **Identify Bobby's email** — You'll need to check the Stripe Dashboard for the customer email (the API didn't return it in the search results). Check both `cus_UD6xHVjHdgC89m` and `cus_U6MFUycgiCrF5T` in the [Stripe Dashboard](https://dashboard.stripe.com/customers).
2. **Manually provision the account** — Once we have the email, we can use the `stripe-webhook` logic manually by invoking the edge function or running the provisioning steps:
  - Create the Supabase user via admin API
  - Create the profile
  - Assign the `core` role in `user_roles`
  - Generate and send a password-set recovery email
3. **Deploy the stripe-webhook** — Ensure the latest code is deployed and verify the webhook is registered in Stripe pointing to: `https://cguoaokqwgqvzkqqezcq.supabase.co/functions/v1/stripe-webhook`

### Steps to Implement

**Step 1**: You provide Bobby Brown's email (check the Stripe Dashboard linked above) - [jjgagliardi8@gmail.com](mailto:jjgagliardi8@gmail.com)

**Step 2**: I will create an edge function or use existing admin tools to:

- Create the user in Supabase auth
- Create their profile with first_name "Bobby", last_name "Brown"
- Insert `core` role into `user_roles`
- Generate a recovery link and send the password-set email

**Step 3**: Deploy the `stripe-webhook` and verify it's receiving events by checking:

- The webhook endpoint URL in Stripe Dashboard → Developers → Webhooks
- That it points to `https://cguoaokqwgqvzkqqezcq.supabase.co/functions/v1/stripe-webhook`
- That the signing secret matches the `STRIPE_WEBHOOK_SECRET` in Supabase secrets

### What I Need From You

**Bobby Brown's email address** — either tell me directly or check the two Stripe customers in the dashboard. Once I have that, I can provision his account immediately.