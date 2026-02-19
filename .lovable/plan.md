

# Hardcode "New Event Template" ID in ClickUp Folder Creation

## What We Found
The ClickUp API returned three templates:
| Template Name | Template ID |
|---|---|
| REOP Event Template | t-90117555884 |
| New Agent Template | t-90117436868 |
| **New Event Template** | **t-90117396506** |

The current code uses `.includes("event")` which was matching "REOP Event Template" first -- the wrong one.

## Fix
**File: `supabase/functions/clickup-create-event-folder/index.ts`**

Hardcode the template ID `t-90117396506` and remove the API call to discover templates. This is faster (saves one API call) and guarantees the correct template is always used.

### Changes
1. Add a constant at the top: `const EVENT_TEMPLATE_ID = "t-90117396506";`
2. Replace the template discovery block (lines 83-105) with a direct call: `POST /space/{SPACE_ID}/folder_template/t-90117396506`
3. Keep the fallback logic (manual folder + 3 lists) in case the template is ever deleted

## Cleanup Note
Two test folders were accidentally created in ClickUp during debugging (folder IDs: 90117639687, 90117639689). You may want to delete those from ClickUp manually.
