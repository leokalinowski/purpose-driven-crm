

## Plan: Self-Service Account Settings + Unified Branding

### Problem

There are **two separate copies of branding colors** being maintained:
1. **`profiles` table** -- written by the Admin "Edit" button in Team Management (lines 448-466 of AdminTeamManagement.tsx)
2. **`agent_marketing_settings` table** -- written by the Admin "Marketing" button

Most edge functions (event emails, RSVP confirmation, invitation emails) read branding from `profiles`. The EventForm was recently updated to read from `agent_marketing_settings`. These two sources frequently disagree.

Additionally, there is **no Settings page** for non-admin users. They cannot edit their own name, brokerage, phone, branding, logos, etc.

### Solution

1. **Make `agent_marketing_settings` the single source of truth for branding** (colors, headshot, logos). Remove branding fields from the `profiles` update flow in Admin Team Management -- instead sync them to `agent_marketing_settings`.

2. **Create a `/settings` page** available to ALL tiers where users can edit their own profile info and branding.

3. **Update edge functions** to read branding from `agent_marketing_settings` instead of `profiles`.

4. **Restrict admin-only tabs** (Integrations, Images, Backgrounds) when rendered in self-service mode.

### Implementation Details

**1. New RLS policies on `agent_marketing_settings`**

Migration to add INSERT and UPDATE policies so users can manage their own row:
- `Users can insert their own marketing settings` (INSERT, `user_id = auth.uid()`)
- `Users can update their own marketing settings` (UPDATE, `user_id = auth.uid()`)

**2. Create `/settings` page (`src/pages/Settings.tsx`)**

A new page that:
- Loads profile data from `profiles` (name, email, brokerage, team, phone, office, website, licenses)
- Loads branding data from `agent_marketing_settings` (colors, headshot, logos, content guidelines)
- Saves profile info to `profiles`, branding to `agent_marketing_settings` (via upsert)
- Reuses `AgentMarketingSettingsForm` internally but with a new `isAdmin` prop that hides the Integrations, Images, and Backgrounds tabs for non-admin users
- Includes file upload for headshot and logos (reusing existing `uploadFile` pattern from AdminTeamManagement)

**3. Update `AgentMarketingSettingsForm` to support self-service mode**

Add an `isAdmin?: boolean` prop (default `true` for backward compatibility). When `false`:
- Hide the Integrations, Images, and Backgrounds tabs (show only Branding + Content)
- Change header text from "Marketing Settings for {name}" to "My Branding & Content"

**4. Consolidate branding in Admin Team Management**

In `handleSaveAgentChanges` (AdminTeamManagement.tsx), after saving profile fields to `profiles`, also upsert the branding fields (colors, headshot, logos) to `agent_marketing_settings`. Remove the duplicate branding color fields from the Edit dialog entirely -- branding is now managed via the Marketing button or the user's own Settings page.

**5. Update edge functions to read from `agent_marketing_settings`**

These 4 edge functions currently read `primary_color`, `secondary_color`, `headshot_url`, `logo_colored_url` from `profiles`:
- `event-reminder-email`
- `event-email-scheduler`  
- `rsvp-confirmation-email`
- `send-event-invitation`

Update each to JOIN or separately query `agent_marketing_settings` for branding, falling back to `profiles` values (for backward compat during migration).

**6. Update `useEvents.ts` to read from `agent_marketing_settings`**

Lines 137-141 currently query `profiles` for `primary_color`. Change to query `agent_marketing_settings`.

**7. Add Settings link to sidebar**

Add a "Settings" item to the main navigation in `AppSidebar.tsx` (below Support Hub, above admin section), available to all roles.

**8. Add route to `App.tsx`**

Add `<Route path="/settings" element={<Settings />} />`.

### Files to Create/Modify

| File | Action |
|---|---|
| Migration | **Create** -- add INSERT/UPDATE RLS for `agent_marketing_settings` |
| `src/pages/Settings.tsx` | **Create** -- self-service settings page |
| `src/components/admin/AgentMarketingSettingsForm.tsx` | **Modify** -- add `isAdmin` prop to hide admin-only tabs |
| `src/pages/AdminTeamManagement.tsx` | **Modify** -- remove duplicate branding from Edit dialog, sync to `agent_marketing_settings` on save |
| `src/components/layout/AppSidebar.tsx` | **Modify** -- add Settings nav item |
| `src/App.tsx` | **Modify** -- add `/settings` route |
| `src/hooks/useEvents.ts` | **Modify** -- read branding from `agent_marketing_settings` |
| `src/components/events/EventForm.tsx` | Already reads from `agent_marketing_settings` (done) |
| `supabase/functions/event-reminder-email/index.ts` | **Modify** -- read branding from `agent_marketing_settings` |
| `supabase/functions/event-email-scheduler/index.ts` | **Modify** -- read branding from `agent_marketing_settings` |
| `supabase/functions/rsvp-confirmation-email/index.ts` | **Modify** -- read branding from `agent_marketing_settings` |
| `supabase/functions/send-event-invitation/index.ts` | **Modify** -- read branding from `agent_marketing_settings` |

