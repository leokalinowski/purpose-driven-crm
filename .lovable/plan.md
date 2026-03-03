

## Plan: Make Events page responsive

Several areas have fixed layouts that break on smaller screens.

### Changes

**1. `src/pages/Events.tsx`**
- Header: Change `flex items-center justify-between` to stack vertically on mobile (`flex-col sm:flex-row`)
- All Events list items: Stack the event info and action buttons vertically on mobile; wrap action buttons
- Tab triggers: Allow horizontal scrolling on mobile if needed
- Invite Database card: Stack text and button vertically on small screens

**2. `src/components/events/SelfManagedTaskDashboard.tsx`**
- Loading skeleton grid: Change `grid-cols-4` to `grid-cols-2 md:grid-cols-4`
- Task row action buttons (edit/delete): On small screens, make them visible via a more compact layout
- Task content: Ensure `min-w-0` and truncation work properly with flex wrapping

**3. `src/components/events/EventProgressStats.tsx`**
- Already uses `grid-cols-2 md:grid-cols-4` -- no change needed

**4. `src/components/events/EventProgressDashboard.tsx`**
- Loading skeleton grid: Change `grid-cols-4` to `grid-cols-2 md:grid-cols-4`

### Summary
~4 files, mostly changing flex/grid classes to stack on mobile. No logic changes.

