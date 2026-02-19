

# Hub-to-ClickUp: Auto-Create Event Folder from Template on New Event

## Overview
When an admin creates a new event in the Hub for a specific agent, the system will automatically:
1. Create the Hub event + RSVP page (already works)
2. Create a ClickUp Folder from template in the Events space
3. Name it following the convention: `AgentFirstName [MM.DD.YY] Event Title`
4. Retrieve the 3 list IDs (Pre-Event, Event Day, Post-Event) from the newly created folder
5. Store the folder ID + list IDs back on the Hub event record

The existing manual "Link Events" and "Sync Tasks" buttons stay in place for the current batch of events.

## Step 1: Discover the Folder Template ID

ClickUp has a `GET /team/{team_id}/folder_template` endpoint to list available folder templates. We need to call this once to find the Events template ID. The new edge function will handle this automatically by listing templates and matching by name, or we can hardcode the ID once discovered.

**Approach**: The new edge function will first call `GET /team/9011620633/folder_template` to find the template. If not found, it falls back to creating a plain folder + 3 empty lists manually.

## Step 2: New Edge Function -- `clickup-create-event-folder`

This function will be called after a new event is created in the Hub.

**Input**: `{ eventId, agentId, eventTitle, eventDate }`

**Logic**:
1. Look up the agent's first name from the `profiles` table
2. Format the folder name: `AgentFirstName [MM.DD.YY] Event Title`
3. Try to create from the Events folder template:
   - `POST /space/90114016189/folder_template/{template_id}` with `{ name: folderName }`
4. If no template found, fall back to:
   - Create a plain folder: `POST /space/90114016189/folder` with `{ name: folderName }`
   - Create 3 lists inside it: Pre-Event, Event Day, Post-Event
5. Retrieve the lists from the new folder: `GET /folder/{folder_id}/list`
6. Classify lists (pre/day/post) and update the Hub event record with:
   - `clickup_folder_id`
   - `clickup_pre_event_list_id`
   - `clickup_event_day_list_id`
   - `clickup_post_event_list_id`
7. Return success/failure report

## Step 3: Integrate into Event Creation Flow

Update `addEventAsAdmin` in `useEvents.ts` (and optionally `addEvent` for agent self-creation) to call the new edge function right after the event is inserted into the database.

The call will be fire-and-forget style with error handling -- if the ClickUp folder creation fails, the event still exists in the Hub, and the admin gets a toast notification about the ClickUp error so they can retry manually.

## Step 4: Add Config Entry

Add `clickup-create-event-folder` to `supabase/config.toml` with `verify_jwt = false` (function validates internally).

## Files to Create
- `supabase/functions/clickup-create-event-folder/index.ts` -- New edge function

## Files to Modify
- `supabase/config.toml` -- Add function entry
- `src/hooks/useEvents.ts` -- Call the new edge function after event creation in both `addEvent` and `addEventAsAdmin`

## Technical Details

### Folder Name Format
```
Samir [03.14.26] The Real Estate Scholarship
```
- Agent first name from `profiles.full_name` (split on space, take first)
- Date formatted as MM.DD.YY from the event date
- Event title as-is

### ClickUp API Calls (in sequence)
1. `GET /team/9011620633/folder_template` -- find template ID (cached or hardcoded after first run)
2. `POST /space/90114016189/folder_template/{id}` -- create folder from template
3. `GET /folder/{new_folder_id}/list` -- get the 3 lists
4. Update Hub `events` table with IDs

### Fallback (no template found)
1. `POST /space/90114016189/folder` -- create empty folder
2. `POST /folder/{id}/list` x3 -- create Pre-Event, Event Day, Post-Event lists
3. Same update to Hub events table

### Error Handling
- ClickUp API failure: event still created in Hub, toast shows error, admin can use "Link Events" button as fallback
- Template not found: falls back to manual folder+list creation
- Network timeout: logged, no retry (admin can re-trigger manually)

