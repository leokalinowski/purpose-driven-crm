

## Plan: Fix Stripe Webhook Reliability Issues

Three bugs need fixing to make the checkout-to-account flow reliable.

### Bug 1: User lookup doesn't filter by email (Line 153)

`listUsers({ page: 1, perPage: 1 })` fetches only the first user in the database, not filtered by email. Fix: use `listUsers({ filter: { email: customerEmail } })` or iterate pages. Supabase admin API doesn't support email filter directly, so the correct approach is to use `supabase.auth.admin.listUsers()` without pagination and search by email, OR use the `getUserByEmail` workaround by attempting `createUser` first (which the code already falls back to).

**Fix**: Replace the initial `listUsers` call with a direct attempt to find the user using a full list scan with proper pagination, or better yet, just skip directly to `createUser` and handle the "already registered" error as the primary lookup path (which is what the code already does as a fallback). This simplifies the logic significantly.

### Bug 2: Metadata not being injected into subscription

The logs show `metadata: {}` on the subscription. The `create-checkout` function passes metadata in `subscription_data.metadata`, but the test checkout may have been created via Stripe Dashboard or a different path. Need to verify the `create-checkout` code is actually being used and that the metadata is flowing correctly.

**Fix**: Add additional logging to `create-checkout` to confirm metadata is being set. Also ensure the `session.metadata` (top-level) is checked alongside `subscription.metadata` in the webhook, which the code already does via `sessionMetadata`.

### Bug 3: Old roles not cleaned up before assigning new tier

When a user checks out for `core`, any existing `managed` role (or vice versa) should be removed first to avoid conflicting roles.

**Fix**: Before the role upsert, delete any existing `core` or `managed` roles for the user, then insert the new one.

### Changes

#### `supabase/functions/stripe-webhook/index.ts`

1. **Simplify user lookup** (lines 151-164): Remove the fragile `listUsers({ page:1, perPage:1 })` approach. Instead, go straight to `createUser` and handle the "already registered" conflict as the primary user-discovery mechanism. This is simpler and always correct.

2. **Clean up old subscription roles** (lines 287-296): Before upserting the new role, delete any existing `core`/`managed` roles for that user so they don't accumulate.

3. **Add metadata fallback from session** (line 149): Also check `session.metadata.user_id` before falling back to email-based lookup (already done, just ensure it's working).

### Summary

- Fix user lookup to not rely on broken paginated list
- Clean up conflicting roles on new checkout  
- The "Pay First" new-user flow (create account + welcome email) is already correct for genuinely new emails; only the existing-user path was buggy

