

# Update Team Management + Agent List to Support All Four Tiers

## Changes

### 1. `src/pages/AdminTeamManagement.tsx`

**Type definition (line 42):** Change `'agent' | 'admin'` to `'agent' | 'admin' | 'managed' | 'core'` in both the state type and the `onValueChange` handler.

**Role dropdown (lines 981-989):** Add `core` and `managed` options to the Select, with descriptive labels:
- Core ($149/mo)
- Managed ($449/mo)
- Agent (DFY Premium)
- Admin

**Agent badge display (lines 700-711):** Update the badge to show all four tiers with distinct styling instead of just "Admin" vs "Agent".

**`handleEditAgent` (line 299):** Update the cast to include all four roles.

### 2. `src/hooks/useAgents.ts`

Check if the `Agent` interface and query need updating to return the correct role for `core`/`managed` users (since the role comes from `user_roles` table).

### 3. Files to modify
- `src/pages/AdminTeamManagement.tsx` — role dropdown, badge display, type widening
- Potentially `src/hooks/useAgents.ts` — if the Agent type restricts roles

