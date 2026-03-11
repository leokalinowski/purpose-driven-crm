

## Issue: Sidebar Tabs Missing

This is **not caused by the scoreboard changes**. The only sidebar edit was renaming "Coaching Management" to "SphereSync Management" — no filtering logic was touched.

### Root Cause

The `useFeatureAccess` hook filters sidebar items with `hasAccess(item.url)`. When the `get_current_user_role` RPC returns `null` (no role assigned for the current user), `getTierLevel(null)` returns `99`. Since every route in `ROUTE_MIN_TIER` — including "core" routes like `/`, `/database`, `/coaching` — requires a tier level of 5 or lower, they all fail the check and get hidden. Only `/settings` survives because it's not listed in `ROUTE_MIN_TIER` at all.

### Fix

In `useFeatureAccess.ts`, treat `null` role as `'core'` (the most basic tier) instead of returning level `99`. This way, users without an assigned role can still see all core-tier routes.

| File | Change |
|------|--------|
| `src/hooks/useFeatureAccess.ts` | In `getTierLevel()`, return `TIER_LEVEL['core']` (5) when role is `null` instead of `99`. This ensures unauthenticated/unassigned users see core routes (Dashboard, SphereSync, Database, Coaching, Newsletter, Support, Settings). Managed/agent routes remain gated. |

Single-line change in the `getTierLevel` function:
```
if (!role) return TIER_LEVEL['core']; // was: return 99
```

