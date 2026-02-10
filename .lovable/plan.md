

# Fix: Metricool User ID and Shade Folder Path Corrections

## Changes Summary

Two corrections to the Scenario 05 implementation based on your clarifications:

### 1. Metricool: Use brand_id as userId (no separate column needed)

The `metricool_user_id` column we just added is unnecessary -- the `metricool_brand_id` already serves as both the `userId` and `blogId` parameters in the Metricool API calls.

**What changes:**
- Remove the `metricool_user_id` column from `agent_marketing_settings` (drop migration)
- Update `clickup-social-ready-to-schedule` to use `metricool_brand_id` for both `userId` and `blogId` parameters in all Metricool API calls
- Remove the `metricool_user_id` reference from the TypeScript types and the hook interface

### 2. Shade: Store parent folder path, not subfolder

The current `shade_folder_id` values point to a specific subfolder (e.g. `/Clients/Timothy Raiford/Social Upload/01 upload`), but files move between folders during the workflow. We need to store the parent folder path so the system can search across all subfolders.

**What changes:**
- Update each agent's `shade_folder_id` to the parent path (e.g. `/Clients/Timothy Raiford/Social Upload/`) by trimming the trailing `/01 upload` segment
- This way, Scenario 02 (file watcher) can search within the parent and find files regardless of which subfolder they're in
- Scenario 05 itself already gets the specific Shade Asset ID from the ClickUp task custom field, so it doesn't rely on the folder path -- but having the correct parent path is important for Scenario 02

---

## Technical Details

### Migration 1: Drop `metricool_user_id` column

```sql
ALTER TABLE agent_marketing_settings
DROP COLUMN IF EXISTS metricool_user_id;
```

### Migration 2: Update Shade folder paths to parent

```sql
UPDATE agent_marketing_settings
SET shade_folder_id = regexp_replace(shade_folder_id, '/\d+ upload$', '/')
WHERE shade_folder_id LIKE '%/_ upload'
   OR shade_folder_id LIKE '%/__ upload';
```

This trims `/01 upload`, `/02 upload`, etc. to just `/`, giving us:
- `/Clients/Timothy Raiford/Social Upload/` (instead of `/Clients/Timothy Raiford/Social Upload/01 upload`)

### Edge Function Update: `clickup-social-ready-to-schedule`

Lines 270-273 change from:

```typescript
const metricoolBrandId = mktSettings.metricool_brand_id;
const metricoolUserId = mktSettings.metricool_user_id;
if (!metricoolBrandId) throw new Error("Missing metricool_brand_id");
if (!metricoolUserId) throw new Error("Missing metricool_user_id");
```

To:

```typescript
const metricoolBrandId = mktSettings.metricool_brand_id;
if (!metricoolBrandId) throw new Error("Missing metricool_brand_id");
```

And all Metricool API calls change `userId=${metricoolUserId}` to `userId=${metricoolBrandId}`.

### TypeScript Type Update

Remove `metricool_user_id` from:
- `src/hooks/useAgentMarketingSettings.ts` (interface)
- `src/integrations/supabase/types.ts` (auto-generated, will update after migration)

### Files Modified

1. New migration SQL (drop column + update paths)
2. `supabase/functions/clickup-social-ready-to-schedule/index.ts` -- use `metricool_brand_id` everywhere
3. `src/hooks/useAgentMarketingSettings.ts` -- remove `metricool_user_id` from interface
4. `src/integrations/supabase/types.ts` -- remove `metricool_user_id` from types

