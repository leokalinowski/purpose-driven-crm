

# Fix: Kate Atkisson Incorrectly Assigned as Agent on Tasks

## Problem
Kate Atkisson (admin/operations) is assigned to many ClickUp tasks across Samir's, Ashley's, and Timothy's events. The sync function matches her ClickUp email to her Hub profile and sets her as the `agent_id` on 18 tasks -- making those tasks appear under Kate's dashboard instead of the actual agent's.

The `agent_id` column on `clickup_tasks` should represent **which Hub agent this task belongs to** (i.e., whose event it is), not who is doing the work in ClickUp. The person doing the work is already captured in `responsible_person`.

## Current Broken Data
| Event | Event Agent | Tasks wrongly assigned to Kate |
|-------|-------------|-------------------------------|
| The Real Estate Scholarship | Samir Redwan | 9 tasks |
| Purge and Perk | Ashley Spencer | 4 tasks |
| Right Sizing | Timothy Raiford | 5 tasks |

## Solution

### 1. Fix the sync logic (`clickup-sync-event-tasks`)
Change `agent_id` resolution: instead of using the first ClickUp assignee's email, **always use the event's `agent_id`**. The ClickUp assignee names already go into `responsible_person`, which is the correct place for that data.

Before (broken):
- Look at ClickUp assignees, match email to profiles, use as `agent_id`
- Falls back to event's `agent_id` only if no email match

After (fixed):
- Always set `agent_id` to the event's `agent_id`
- ClickUp assignee names remain in `responsible_person` (no change)

### 2. Fix existing bad data
Run a data fix to update the 18 Kate-assigned tasks to use the correct event agent's ID:
```sql
UPDATE clickup_tasks ct
SET agent_id = e.agent_id
FROM events e
WHERE ct.event_id = e.id
  AND e.agent_id IS NOT NULL;
```

### 3. Update `clickup-webhook` too
Apply the same logic change so real-time webhook updates also use the event's `agent_id` instead of the ClickUp assignee.

## Files to Modify
- `supabase/functions/clickup-sync-event-tasks/index.ts` -- Simplify agent_id to always use event's agent_id
- `supabase/functions/clickup-webhook/index.ts` -- Same fix for real-time updates

## Data Fix
- Update all existing `clickup_tasks` rows to set `agent_id` from their parent event's `agent_id`

