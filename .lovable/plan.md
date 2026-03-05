

## Hide Social Media Tab from Core and Managed Users

Two changes needed:

### 1. Update route tier requirement
**File:** `src/hooks/useFeatureAccess.ts`

Change `/social-scheduler` minimum tier from `'managed'` to `'agent'` so only Agent, Editor, and Admin roles can access it.

### 2. Fully hide (not just lock) the menu item
**File:** `src/components/layout/AppSidebar.tsx`

Currently, inaccessible items show with a lock icon and reduced opacity. Change the sidebar to completely skip rendering menu items where `hasAccess()` returns false — so Core and Managed users won't see "Social Media" at all.

