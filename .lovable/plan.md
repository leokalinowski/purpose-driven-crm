## Sync Support Ticket Status from ClickUp to Hub

### Status: ✅ IMPLEMENTED

---

### What Was Built

1. **`register-support-webhook` Edge Function** - Registers a webhook with ClickUp for the Hub Agent Support list
   - Fetches team ID from the list details
   - Registers webhook for `taskUpdated`, `taskStatusUpdated`, `taskAssigneeUpdated`, `taskCommentPosted` events
   - Stores webhook metadata in `clickup_webhooks` table

2. **Enhanced `support-ticket-webhook` Handler** - Improved event processing
   - Added comprehensive status mapping function
   - Handles multiple event types: `taskStatusUpdated`, `taskUpdated`, `taskAssigneeUpdated`
   - Better logging for debugging

3. **Admin UI Component** - `SupportWebhookManager.tsx`
   - Shows webhook registration status
   - One-click webhook registration
   - Located in Team Management → Integrations tab

---

### Status Mapping

| ClickUp Status | Hub Status |
|----------------|------------|
| `to do`, `open`, `new`, `pending` | `open` |
| `in progress`, `working`, `in review`, `active` | `in_progress` |
| `done`, `complete`, `completed`, `closed`, `resolved`, `fixed` | `resolved` |

---

### How to Use

1. Go to **Admin Dashboard → Team Management**
2. Click the **Integrations** tab
3. Click **Register Webhook** button
4. Once registered, status changes in ClickUp will automatically sync to the Hub

---

### Files Created/Updated

| File | Action |
|------|--------|
| `supabase/functions/register-support-webhook/index.ts` | Created |
| `supabase/functions/support-ticket-webhook/index.ts` | Updated |
| `supabase/config.toml` | Updated |
| `src/components/admin/SupportWebhookManager.tsx` | Created |
| `src/pages/AdminTeamManagement.tsx` | Updated |
