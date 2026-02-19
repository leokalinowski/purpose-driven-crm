

# Auto-Link ClickUp Event Folders to Hub Events and Sync Tasks

## Problem
The Hub events (like Samir's "The Real Estate Scholarship") have no connection to their ClickUp folders. The `clickup_list_id` on every event is null. The sync function sits idle because there's nothing to sync.

Meanwhile, the ClickUp Events space already has perfectly organized folders per agent:
- `Samir [03.14.26] The Real Estate Scholarship` (folder with 3 lists)
- `Ashley [03.21.26] Purge & Perk` (folder with 3 lists)
- `Tim [03.21.26] Right Sizing` (folder with 3 lists)
- `Rashida [03.21.26] - The Real Estate Scholarship` (folder with 3 lists)
- etc.

Each folder contains **Pre-Event**, **Event Day**, and **Post-Event** lists.

## Solution

### 1. Expand Database Schema

The current `events` table has a single `clickup_list_id` column, but each ClickUp event folder has 3 lists. We need to store the folder ID plus all 3 list IDs.

**Add columns to `events`:**
| Column | Type | Purpose |
|--------|------|---------|
| `clickup_folder_id` | text | The ClickUp folder ID for the event |
| `clickup_pre_event_list_id` | text | Pre-Event list ID |
| `clickup_event_day_list_id` | text | Event Day list ID |
| `clickup_post_event_list_id` | text | Post-Event list ID |

The existing `clickup_list_id` stays as a fallback/legacy field.

### 2. New Edge Function: `clickup-link-events`

An admin-triggered function that:
1. Fetches all folders from the ClickUp **Events** space (ID: `90114016189`)
2. For each folder, parses the name pattern: `AgentFirstName [date] Event Title`
3. Matches to Hub events by comparing the event title AND the agent's first name (from `profiles`)
4. Writes the folder ID and all 3 list IDs to the matched Hub event
5. Returns a report of what was linked and what couldn't be matched

**Matching logic:**
- Folder name: `Samir [03.14.26] The Real Estate Scholarship`
- Hub event: title = `The Real Estate Scholarship`, agent = `Samir Redwan`
- Match on: event title is contained in folder name AND agent first name is in folder name

### 3. Update `clickup-sync-event-tasks` to Use All 3 Lists

Currently syncs from a single `clickup_list_id`. Update to:
1. For each event, sync tasks from all 3 lists (pre-event, event day, post-event)
2. Tag each task with which phase it belongs to (add a `phase` column to `clickup_tasks`: pre_event, event_day, post_event)
3. Skip the "event" tag filter since all tasks in these lists are event-related by definition
4. Fall back to `clickup_list_id` if the new columns are not set (backward compatibility)

### 4. Add `phase` Column to `clickup_tasks`

| Column | Type | Purpose |
|--------|------|---------|
| `phase` | text | "pre_event", "event_day", or "post_event" |

This lets the agent dashboard group tasks by phase, giving a clear picture of what needs to happen before, during, and after the event.

### 5. Update UI to Show Phase Grouping

Update `EventProgressDashboard` and `EventTaskList` to group tasks by phase (Pre-Event / Event Day / Post-Event) with separate progress bars per phase.

### 6. Admin "Link Events" Button

Add a button on the Admin Events Management page ("ClickUp Tasks" tab) that triggers `clickup-link-events`. Shows the matching results so the admin can verify before syncing.

## Matching Example

```text
ClickUp Folder                                    --> Hub Event Match
--------------------------------------------------------------
Samir [03.14.26] The Real Estate Scholarship      --> Samir Redwan's "The Real Estate Scholarship" (03/14)
Ashley [03.21.26] Purge & Perk                    --> Ashley Spencer's "Purge & Perk" (03/21)
Tim [03.21.26] Right Sizing                       --> Timothy Raiford's "Right Sizing" (03/21)
Rashida [03.21.26] - The Real Estate Scholarship  --> Rashida Lambert's "The Real Estate Scholarship" (03/21)
Amy [03.21.26] The Real Estate Scholarship        --> (no Hub event yet for Amy -- will report as unmatched)
```

## Files to Create
- `supabase/functions/clickup-link-events/index.ts` -- Auto-matching edge function
- Migration SQL for new columns on `events` and `clickup_tasks`

## Files to Modify
- `supabase/functions/clickup-sync-event-tasks/index.ts` -- Sync from all 3 lists per event, tag with phase, remove "event" tag filter
- `supabase/config.toml` -- Add `clickup-link-events` entry
- `src/components/admin/AdminEventTasks.tsx` -- Add "Link Events to ClickUp" button
- `src/components/events/EventProgressDashboard.tsx` -- Group tasks by phase
- `src/components/events/EventTaskList.tsx` -- Show phase badges, filter by phase
- `src/components/events/EventProgressStats.tsx` -- Phase-level progress stats
- `src/hooks/useClickUpTasks.ts` -- Include phase in data model and grouping

## Technical Details

### Folder Name Parsing
The ClickUp folder names follow patterns like:
- `Samir [03.14.26] The Real Estate Scholarship`
- `Ashley [03.21.26] Purge & Perk`
- `Rashida [03.21.26] - The Real Estate Scholarship`

Parse with regex: `/^(\w+)\s+\[[\d.]+\]\s*-?\s*(.+)$/`
- Group 1: Agent first name
- Group 2: Event title

### List Name Matching
Inside each folder, lists are named "Pre-Event", "Event Day", "Post-Event" (with minor spelling variations like "Pre-Event"). Match using case-insensitive contains: `pre`, `day`, `post`.

### Sync Flow After Linking
```text
Admin clicks "Link Events" --> clickup-link-events runs
  |-- Fetches Events space folders from ClickUp API
  |-- Matches to Hub events by name + agent
  |-- Writes folder_id + 3 list IDs to events table
  |-- Returns match report

Admin clicks "Sync Tasks" --> clickup-sync-event-tasks runs
  |-- For each event with list IDs set
  |-- Fetches tasks from all 3 lists (no tag filter needed)
  |-- Upserts to clickup_tasks with phase + agent_id
  |-- Agent sees progress on their Events page
```
