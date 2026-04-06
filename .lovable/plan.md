

## Add Team Calls Widget to Support Hub

A new card placed between the header and action items on the Support page, showing the two recurring weekly calls with a "Join Call" button linking to the Zoom room.

### New Component

**`src/components/support/TeamCallsWidget.tsx`**

A card with two call entries, each showing:
- Day and time (e.g. "Every Tuesday at 3:00 PM" / "Every Thursday at 11:00 AM")
- A status indicator: "Live Now" (green pulse) if current time falls within the call window, or "Next call in X days" otherwise
- A "Join Call" button linking to the Zoom URL (opens in new tab)
- Video icon for visual clarity

The Zoom link will be hardcoded initially. If you want to change it later, it's a single constant at the top of the file.

### Page Update

**`src/pages/Support.tsx`**

Insert the `<TeamCallsWidget />` immediately after the page header (before action items banner), so it's one of the first things users see.

### Design

- Matches existing card style (same `Card` / `CardHeader` / `CardContent` components)
- Two-column layout on desktop, stacked on mobile
- "Live Now" badge with a pulsing green dot when the call is happening (30-min window)
- External link icon on the Join button

### Technical Details

- "Live Now" detection: compares current day/hour against the schedule using `new Date()` — checks if it's the right weekday and within a ~60 minute window of the start time
- No database needed — purely frontend, static schedule
- I'll need you to provide the Zoom link after implementation, or I can use a placeholder

