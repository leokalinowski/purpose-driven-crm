

## Explore ClickUp Workspace Structure

### Summary

Create a utility edge function to fetch and display the complete ClickUp workspace hierarchy (Workspace → Spaces → Folders → Lists) so we can identify the correct List ID for support tickets.

---

### Current State

- **CLICKUP_SUPPORT_LIST_ID** secret exists but we need to verify it points to the correct location
- The `create-support-ticket` function uses this List ID to create tasks
- Team ID for "Real Estate on Purpose" is: `9011620633`

---

### Implementation Details

#### 1. Create New Edge Function: `clickup-get-workspace-structure`

This function will:
1. Fetch all Spaces in the "Real Estate on Purpose" team
2. For each Space, fetch all Folders
3. For each Folder, fetch all Lists
4. Also fetch "folderless" lists directly in each Space
5. Return a complete hierarchy for review

**ClickUp API endpoints needed:**
- `GET /team/{team_id}/space` - Get all spaces
- `GET /space/{space_id}/folder` - Get folders in a space
- `GET /folder/{folder_id}/list` - Get lists in a folder
- `GET /space/{space_id}/list` - Get folderless lists

#### 2. Test and Identify Correct List

After creating the function, we'll call it to see the full structure and identify:
- The correct Space (e.g., "Support", "Operations", etc.)
- The correct Folder (if applicable)
- The correct List for support tickets

#### 3. Update CLICKUP_SUPPORT_LIST_ID Secret

Once we identify the correct list, update the secret with the proper List ID.

---

### Files to Create

| File | Purpose |
|------|---------|
| `supabase/functions/clickup-get-workspace-structure/index.ts` | Fetch and display ClickUp hierarchy |

---

### Edge Function Code Structure

```typescript
// Pseudocode structure
1. Get CLICKUP_API_TOKEN from secrets
2. Fetch spaces for team 9011620633
3. For each space:
   - Fetch folders
   - For each folder, fetch lists
   - Fetch folderless lists
4. Return structured hierarchy with IDs and names
```

---

### After Implementation

1. Call the new edge function to see the workspace structure
2. Review the output together to identify the correct Support Tickets list
3. Update CLICKUP_SUPPORT_LIST_ID with the correct value
4. Test ticket creation to verify it lands in the right place

