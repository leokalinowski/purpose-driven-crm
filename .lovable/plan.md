

# Redesign: Event-Centric Admin Events Page

## Overview
Replace the current 3-tab layout (Events Management / Email Management / ClickUp Tasks) with a single event-centric view where clicking an event row in the table reveals all related data (RSVPs, ClickUp Tasks, Emails) in an expandable detail panel below the table.

## Current Problems
- Email Management and ClickUp Tasks live in separate tabs, disconnected from the event they belong to
- You have to select an event again inside each tab
- No task progress visibility in the events table itself

## New Layout

```text
+---------------------------------------------------------------+
| Events Management                      [Create Event] [Export] |
| Manage all events across all agents...                         |
+---------------------------------------------------------------+
| [Stats Cards: Total | Upcoming | RSVPs | Avg Attendance]      |
+---------------------------------------------------------------+
| [Filters: Search | Status | Agent]                             |
+---------------------------------------------------------------+
| All Events (7)                                                 |
| Event | Date | Agent | Location | RSVPs | Tasks | Status | ... |
| -------|------|-------|----------|-------|-------|--------|------|
| > The Real Estate Scholarship | Mar 21 | ... | 0/30 | 45% |..|
+---------------------------------------------------------------+
| EXPANDED DETAIL PANEL (when row clicked):                      |
| [Overview] [RSVPs] [ClickUp Tasks] [Emails]                   |
|                                                                |
|  (sub-tab content for the selected event)                      |
+---------------------------------------------------------------+
| Right Sizing | Mar 21 | Timothy | ... | 0/35 | 20% | ...     |
+---------------------------------------------------------------+
```

## Changes

### 1. Add "Tasks %" Column to Events Table
- Query `clickup_tasks` grouped by `event_id` to get completion percentages
- Show a small progress bar + percentage in a new "Tasks" column
- Fetch all task stats in one query when the page loads

### 2. Make Event Rows Clickable to Expand Detail Panel
- Clicking a row sets `selectedEvent` and shows an expandable detail panel directly below the table (not a dialog)
- The detail panel has 4 sub-tabs:
  - **Overview**: Event info card (title, date, location, description, public page link, agent info)
  - **RSVPs**: Existing `RSVPManagement` component, passed the selected event ID
  - **ClickUp Tasks**: Existing `AdminEventTasks` component filtered to single event (or `EventTaskList`/`EventProgressDashboard`)
  - **Emails**: Existing `EmailManagement` component, passed the selected event ID and title
- Clicking the same row again collapses the panel

### 3. Remove Top-Level Tabs
- Remove the 3-tab layout (Events Management / Email Management / ClickUp Tasks)
- Everything lives on one page, contextually tied to the selected event
- The "Link Events to ClickUp" and "Sync Tasks" buttons move into the ClickUp Tasks sub-tab of the detail panel (or stay as global actions in the header area)

### 4. Visual Indicator for Selected Row
- Highlight the selected row with a distinct background color
- Add a chevron indicator showing which row is expanded

## Files to Modify

### `src/pages/AdminEventsManagement.tsx` (major refactor)
- Remove top-level `Tabs` wrapper
- Add task progress data fetch (batch query for all events)
- Add "Tasks" column to table with progress bar
- Add row click handler to toggle `selectedEvent`
- Render detail panel with sub-tabs below table when an event is selected
- Move stats/filters to always be visible (no longer inside a tab)
- Keep "Link Events" and "Sync Tasks" buttons accessible (either in header or in the ClickUp sub-tab)

### No new files needed
- All sub-components (`RSVPManagement`, `EmailManagement`, `AdminEventTasks`/`EventProgressDashboard`) already accept `eventId` as a prop

## Technical Details

### Task Progress Batch Query
On page load, fetch task completion stats for all events in one query:
```sql
SELECT event_id, 
       COUNT(*) as total, 
       COUNT(completed_at) as completed
FROM clickup_tasks 
GROUP BY event_id
```
Store as a `Record<string, { total: number; completed: number }>` map and look up per row.

### Selected Event Detail Panel
The detail panel renders below the table card (or inside it) with sub-tabs:
```tsx
{selectedEvent && (
  <Card className="mt-4">
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="rsvps">RSVPs</TabsTrigger>
        <TabsTrigger value="tasks">ClickUp Tasks</TabsTrigger>
        <TabsTrigger value="emails">Emails</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">...</TabsContent>
      <TabsContent value="rsvps">
        <RSVPManagement eventId={selectedEvent.id} />
      </TabsContent>
      <TabsContent value="tasks">
        <AdminEventTasks events={[selectedEvent]} agents={agents} />
      </TabsContent>
      <TabsContent value="emails">
        <EmailManagement eventId={selectedEvent.id} eventTitle={selectedEvent.title} />
      </TabsContent>
    </Tabs>
  </Card>
)}
```

### Row Highlighting
Selected row gets a distinct style:
```tsx
<TableRow 
  className={cn(
    "cursor-pointer",
    selectedEvent?.id === event.id && "bg-primary/5 border-l-2 border-l-primary"
  )}
  onClick={() => setSelectedEvent(selectedEvent?.id === event.id ? null : event)}
/>
```

