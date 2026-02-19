

# Reorganize Admin Sidebar Navigation

## Problem
The Administration section in the sidebar has 11 flat menu items, making it hard to find what you need quickly.

## Solution
Group the 11 admin links into 4 collapsible sub-sections using the Collapsible component (already installed). Each sub-group has a label and expands/collapses independently. The group containing the currently active route stays open automatically.

## Proposed Grouping

| Sub-Group | Icon | Items |
|-----------|------|-------|
| **Dashboard & Team** | BarChart3 | Admin Dashboard, Team Management |
| **Content & Comms** | Mail | Newsletter Mgmt, Social Media, Events Mgmt, Email Logs |
| **Operations** | Settings | Database Mgmt, SphereSync Recovery, Coaching Mgmt |
| **Business & Research** | Handshake | Sponsor Database, Survey Results |

## How It Works
- Each sub-group has a clickable header that toggles its children open/closed
- The sub-group containing the current page auto-expands on load
- All other sub-groups stay collapsed to reduce clutter
- Clicking a link still navigates to the same pages (no route changes)

## What Changes

### Files Modified
- **`src/components/layout/AppSidebar.tsx`** -- Replace the flat list of 11 admin `SidebarMenuItem` entries with 4 collapsible sub-groups using `Collapsible`, `CollapsibleTrigger`, and `CollapsibleContent` from the existing Radix component

### No Other Changes
- No new pages, routes, database changes, or edge functions
- All existing admin pages remain exactly as they are
- The Admin Dashboard internal tabs (Company Overview, Agent Performance, etc.) stay unchanged

## Technical Details

The sidebar will use the existing `@radix-ui/react-collapsible` component (already in `src/components/ui/collapsible.tsx`) to wrap each sub-group. Each group checks `location.pathname` to determine if it should default to open. A small chevron icon rotates to indicate expanded/collapsed state.

```text
Administration
+-- Dashboard & Team        [v]
|   Admin Dashboard
|   Team Management
+-- Content & Comms          [>]  (collapsed)
|   Newsletter Management
|   Social Media
|   Events Management
|   Email Logs
+-- Operations               [>]  (collapsed)
|   Database Management
|   SphereSync Recovery
|   Coaching Management
+-- Business & Research       [>]  (collapsed)
    Sponsor Database
    Survey Results
```

