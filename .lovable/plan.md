
# Add ClickUp Write-Back: Update Task Fields with Generated Content

## What's Missing Today

The current workflow:
1. ClickUp Automation triggers the webhook
2. The function generates social copy, YouTube titles, and description via AI
3. Results are saved to the `content_generation_results` table in Supabase
4. **Nothing is written back to ClickUp** -- the task fields stay empty

## What This Plan Adds

After generating content, the webhook function will update three ClickUp custom fields on the task:
- **Generated Copy** -- the social media caption
- **YT Title** -- the first YouTube title option (best pick)
- **YT Description** -- the YouTube video description

## Technical Approach

### Step 1: Look up field IDs dynamically

Rather than hardcoding ClickUp custom field IDs (which are fragile), the function will:
1. Fetch the task (already done in step 3 of the current workflow)
2. From the task's `custom_fields` array, find the fields named "Generated Copy", "YT Title", and "YT Description"
3. Use their `id` values for the update calls

This works because the full task object from `GET /task/{id}` already includes all custom fields with their IDs.

### Step 2: Update ClickUp custom fields via API

For each field, call:
```
POST https://api.clickup.com/api/v2/task/{taskId}/field/{fieldId}
Authorization: {CLICKUP_API_TOKEN}
Body: { "value": "the generated content" }
```

For the YT Title field, the function will use the first title from the array of 3 options (the AI picks the best one first).

### File Changes

**`supabase/functions/clickup-generate-copy-webhook/index.ts`**

Add a new step between step 6 (call generate-social-copy) and step 7 (mark run as success):

**New Step 6b: Write generated content back to ClickUp**

```text
Flow:
1. Extract field IDs from the already-fetched task object for:
   - "Generated Copy"
   - "YT Title" 
   - "YT Description"
2. For each field found, call the ClickUp API to set its value
3. Log each update as a workflow step
4. Continue to mark the run as success
```

The function will:
- Use the existing `getCustomField()` helper to find field IDs from the task object
- Use the existing `fetchWithRetry()` helper for resilient API calls
- Log success/failure for each field update via the existing `logStep()` function
- Not fail the entire run if a field update fails (log a warning and continue)

### What Won't Change
- The `generate-social-copy` function stays the same (it just generates content)
- The Supabase database save stays the same
- The checkbox check and agent identification logic stays the same

### Deployment
Redeploy `clickup-generate-copy-webhook` after the change.
