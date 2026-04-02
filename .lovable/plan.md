

## Hide Resources Tab from Non-Admins

Temporarily restrict the Resources page and sidebar link to admin users only, so you can upload files before opening it to agents.

### Changes

1. **`src/hooks/useFeatureAccess.ts`** — Change the `/resources` route tier from `'core'` to `'admin'`

2. **`src/pages/Resources.tsx`** — Add an admin guard (same pattern as `AdminResources.tsx`): if not admin, redirect to `/`

When you're ready to open it up, just change `'admin'` back to `'core'` in `useFeatureAccess.ts` and remove the guard from `Resources.tsx`.

