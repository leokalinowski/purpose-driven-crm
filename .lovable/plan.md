

# Plan: Match Agent TemplateList Layout to Admin Layout

## Current State

The agent's `TemplateList` (image-71) uses a plain `div` wrapper, taller thumbnails (h-48), simple date format, no status badge, and only Edit/Copy/Delete buttons. The admin's `AdminNewsletterTemplates` (image-70) wraps everything in a Card with CardHeader, uses h-40 thumbnails, shows "Active" badges, `formatDistanceToNow` dates, and has Edit + Send + Copy + Delete buttons.

## Changes to `src/components/newsletter/builder/TemplateList.tsx`

1. **Wrap in Card with CardHeader** -- Match the admin's outer Card wrapper with title "Email Templates" and description in a CardHeader, and the grid inside CardContent
2. **Thumbnail height** -- Change from `h-48` to `h-40` to match admin
3. **Date format** -- Switch from `format(date, 'MMM d, yyyy')` to `formatDistanceToNow` with "ago" suffix
4. **Add "Active" badge** -- Show a status badge (agent templates are always active, so show "Active")
5. **Add Send button** -- Add a Send button that opens `SendSchedulePanel` inline, same as admin does. Import `SendSchedulePanel` and wire it with the template's ID and name (no `agentId` prop needed since the agent is the logged-in user)
6. **Button layout** -- Match admin: Edit (outline) + Send (default, flex-1) + Copy (icon) + Delete (icon)
7. **Remove `max-w-4xl mx-auto`** -- Let the card fill available width like the admin version

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/newsletter/builder/TemplateList.tsx` | Restructure layout to match admin card style; add Send button with SendSchedulePanel; update thumbnail height, date format, badge, button arrangement |

