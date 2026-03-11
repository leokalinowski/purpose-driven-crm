

## Hide Content Tab from Core and Managed Users

### Changes

**1. `src/components/admin/AgentMarketingSettingsForm.tsx`**
- Add a new optional prop `showContentTab?: boolean` (default `true`)
- Conditionally render the Content `TabsTrigger` and `TabsContent` only when `showContentTab` is true
- Update the grid-cols class to account for the tab being hidden (when not admin and no content tab, it becomes `grid-cols-1`)

**2. `src/pages/Settings.tsx`**
- Import `useUserRole` (already imported)
- Pass `showContentTab={isAdmin || isAgent}` to `AgentMarketingSettingsForm`, so only Admin and Agent roles see the Content tab

### Result
- Core and Managed users see only the Branding tab in Settings → Branding & Content
- Agent and Admin users continue seeing both Branding and Content tabs
- Admin users still see all 5 tabs (Branding, Content, Integrations, Images, Backgrounds)

