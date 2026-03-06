## Current Post-Payment Flow (What Exists Today)

Here is exactly what happens right now when someone subscribes:


| Step                                    | What Happens                                                                     | Status                          |
| --------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------- |
| 1. **Payment**                          | Customer completes Stripe Checkout from `/pricing`                               | Working                         |
| 2. **Founder schedule** (if applicable) | Converts subscription to a schedule with monthly transition phase                | Working                         |
| 3. **Account creation**                 | Webhook calls `auth.admin.createUser()` to provision Supabase account            | Working (after our trigger fix) |
| 4. **Profile row**                      | Inserts into `profiles` table with name, email, tier                             | Working                         |
| 5. **Role assignment**                  | Clears old subscription roles, inserts `core` or `managed` into `user_roles`     | Working                         |
| 6. **Welcome + password-set email**     | Sends a single email via Resend with a "Set Your Password" button and login link | Working                         |


**That is everything.** There is no step 4 from your list -- no coaching call scheduling email with Pam exists in the codebase today. The only email sent is the welcome/password-set email (step 6 above).

---

## Plan: Add Post-Payment Onboarding Emails

### What to Build

Add a second email sent immediately after the welcome email that schedules a coaching onboarding call with Pam O'Bryant. This would be sent from the same webhook handler, right after the welcome email succeeds.

### Implementation

**File changed: `supabase/functions/stripe-webhook/index.ts**`

After the welcome email is successfully sent (line ~257), add a second Resend API call that sends a "Schedule Your Coaching Call" email. This email would include:

- A greeting referencing their tier (Core or Managed)
- A brief explanation of what the coaching call covers
- A prominent CTA button linking to Pam's scheduling link (e.g., Calendly or similar -- you'll need to provide the URL)
- Pam O'Bryant's name and role

The email would be sent from the same `RESEND_FROM_EMAIL` sender, with a subject like "Next Step: Schedule Your Coaching Call with Pam".

### What I Need From You

Before implementing, I need to know:

1. **What is Pam's scheduling link?** [https://lp.realestateonpurpose.com/appointmentwithreop](https://lp.realestateonpurpose.com/appointmentwithreop)
2. **Should this email go to both Core and Managed tiers, or only one? Yes, send it to both.**
3. **Are there any other emails/steps you want added to this sequence?** (e.g., a "getting started" guide, a 3-day follow-up, etc.) That's it for now. We'll build this later.
4. **Should there be a delay between the welcome email and the coaching email, or send both immediately? Yes, send it 30 seconds after.**