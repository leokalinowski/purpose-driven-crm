

## Sync Support Ticket Status from ClickUp to Hub

### Summary

Register a ClickUp webhook for the Hub Agent Support list so that status changes, assignee updates, and other task modifications in ClickUp are automatically synced back to the Hub portal's `support_tickets` table.

---

### Root Cause

The `support-ticket-webhook` edge function exists but ClickUp isn't calling it because:
- No webhook has been registered with ClickUp for the Hub Agent Support list
- The existing `clickup-register-and-sync` function only registers webhooks for Event task lists

---

### Solution Options

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **Option A: Admin UI Button** | Add a "Register ClickUp Webhook" button in admin settings | One-time setup, visible to admins | Requires manual action |
| **Option B: Auto-Register on Deploy** | Create a setup function that runs once on first ticket creation | Fully automatic | Slightly more complex |
| **Option C: Create Dedicated Function** | New edge function to register the support webhook | Reusable, can be called manually or via cron | Requires initial call |

**Recommended: Option C** - Create a dedicated `register-support-webhook` edge function that can be called once (manually or via admin UI) to set up the webhook.

---

### Implementation Plan

#### 1. Create `register-support-webhook` Edge Function

A new function that:
- Calls ClickUp API to create a webhook for the Hub Agent Support list
- Points the webhook to `support-ticket-webhook` endpoint
- Stores the webhook ID in a config table for future reference
- Subscribes to relevant events: `taskUpdated`, `taskStatusUpdated`, `taskAssigneeUpdated`

```text
supabase/functions/register-support-webhook/index.ts
```

**Logic Flow:**
1. Get `CLICKUP_SUPPORT_LIST_ID` from secrets (already exists)
2. Get ClickUp team ID from the API (or store as secret)
3. Register webhook with ClickUp pointing to `support-ticket-webhook`
4. Save webhook metadata to database

#### 2. Update `support-ticket-webhook` to Handle More Event Types

Current implementation looks for `history_items` with status changes. We should also:
- Handle the `taskStatusUpdated` event type specifically
- Improve status mapping based on actual ClickUp status names in the Support list
- Add logging for debugging webhook payloads

#### 3. Create Database Table for Webhook Tracking (Optional)

Store the registered webhook ID so we can:
- Check if already registered
- Update or delete the webhook if needed

```sql
CREATE TABLE IF NOT EXISTS public.support_webhook_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id text,
  list_id text NOT NULL,
  endpoint text NOT NULL,
  active boolean DEFAULT true,
  registered_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### 4. Add Admin UI to Trigger Registration

Add a button in Admin settings or Support config to:
- Check if webhook is already registered
- Register new webhook if not
- Show status of webhook registration

---

### Required Secrets

Already configured:
- `CLICKUP_API_TOKEN` - For API authentication
- `CLICKUP_SUPPORT_LIST_ID` - The list ID for Hub Agent Support

May need to add:
- `CLICKUP_TEAM_ID` - Team ID for webhook registration (or fetch dynamically)

---

### Status Mapping

Update the webhook handler to map ClickUp statuses properly:

| ClickUp Status | Hub Status |
|----------------|------------|
| `to do` / `open` | `open` |
| `in progress` / `working` | `in_progress` |
| `done` / `complete` / `closed` | `resolved` |

---

### Files to Create/Update

| File | Action | Description |
|------|--------|-------------|
| `supabase/functions/register-support-webhook/index.ts` | Create | New function to register webhook with ClickUp |
| `supabase/functions/support-ticket-webhook/index.ts` | Update | Improve event handling and status mapping |
| `supabase/config.toml` | Update | Add new function config |
| `src/pages/AdminTeamManagement.tsx` or new admin page | Update | Add UI to trigger webhook registration |

---

### Testing Plan

1. Deploy the new `register-support-webhook` function
2. Call it once (via admin UI or direct invocation)
3. Verify webhook appears in ClickUp workspace settings
4. Change a task status in ClickUp (e.g., move to "In Progress")
5. Check `support-ticket-webhook` logs for incoming payload
6. Verify `support_tickets` table is updated with new status

---

### Alternative: Quick Manual Registration

If you prefer a quicker solution, I can provide you with a ClickUp API call you can make directly to register the webhook, without creating a new edge function. Just let me know!

