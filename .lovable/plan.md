

## Fix Pricing Page

Three targeted changes:

### 1. Always show standalone layout (no sidebar)
**File: `src/pages/Pricing.tsx`** — Remove the `if (user)` conditional that wraps content in `<Layout>`. Always render the standalone version with logo header. Keep the "Sign in here" link for unauthenticated users; for authenticated users, add a "Back to Dashboard" link instead.

### 2. Default to Founder Plans tab
**File: `src/pages/Pricing.tsx`** — Change the initial `billing` state from `'monthly'` to `'founder'` so visitors land on the highlighted Founder pricing by default.

### 3. Remove "Support tickets" from Core features
**File: `src/config/stripe.ts`** — Remove `'Support tickets'` from the `core.features` array (line 29).

