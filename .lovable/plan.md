# Add Subscription Tiers: Core & Managed Access Levels

## Current State

- `app_role` enum: `admin | editor | agent`
- `user_roles` table + `get_current_user_role()` RPC
- All agents see all sidebar items

## New Access Hierarchy (highest to lowest)

1. **Admin** — full access + admin panel
2. **Agent** — existing DFY premium, all tabs (no change for current users)
3. **Managed** ($449) — Core + Events, Social Media, Pipeline
4. **Core** ($149) — SphereSync, Database, Scoreboard, Newsletter, DNC, Support Hub, basic Dashboard

## Step 1: Database Migration

Add `core` and `managed` to the `app_role` enum:

```sql
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'managed';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'core';
```

Update `get_current_user_role()` to handle the new priority order: admin(1) > editor(2) > agent(3) > managed(4) > core(5).

## Step 2: Feature Access Map + Hook

Create `src/hooks/useFeatureAccess.ts`:

- Define a `FEATURE_ACCESS` constant mapping each nav route to minimum tier
- Expose `hasAccess(feature)` that checks current role against the map
- Admin and agent roles bypass all checks (full access)
- Core users see: `/`, `/spheresync-tasks`, `/database`, `/coaching`, `/newsletter`, `/support`
- Managed users see all Core routes + `/events`, `/social-scheduler`

## Step 3: Sidebar Gating (`AppSidebar.tsx`)

- Import `useFeatureAccess`
- Filter `menuItems` array: only show items the user's tier can access
- Show a lock icon + "Upgrade" badge on items the user can't access (visible but not navigable)

## Step 4: Page-Level Guards

- Create `src/components/ui/UpgradePrompt.tsx` — displays current tier, required tier, and feature description
- Wrap gated pages (Events, SocialScheduler, Pipeline) with a tier check: if insufficient, render `UpgradePrompt` instead of page content

## Step 5: Admin Tier Assignment UI

- Extend `UserManagement.tsx` (or the Team Management page) with a dropdown to assign `core`, `managed`, or `agent` role to any user
- Uses existing `admin-update-user-metadata` edge function pattern or direct `user_roles` table update

## Step 6: Update TypeScript Types

- Update `src/integrations/supabase/types.ts` to include `core` and `managed` in the `app_role` enum type
- Update `useUserRole.ts` type to include the new roles

## Files to Create

- `src/hooks/useFeatureAccess.ts`
- `src/components/ui/UpgradePrompt.tsx`

## Files to Modify

- `src/integrations/supabase/types.ts` (enum update)
- `src/hooks/useUserRole.ts` (add `isAgent`, `isManaged`, `isCore` helpers)
- `src/components/layout/AppSidebar.tsx` (filter nav items by tier)
- `src/pages/Events.tsx`, `src/pages/SocialScheduler.tsx`, `src/pages/Pipeline.tsx` (page guards)
- `src/components/admin/UserManagement.tsx` (tier assignment dropdown)
- 1 Supabase migration (enum + function update)

## What Does NOT Change

- Existing agents keep `agent` role — no data migration needed, full access preserved
- Admin access unchanged
- All RLS policies continue working (they check `admin` or `auth.uid()`, not tier)
- No Stripe integration in this phase