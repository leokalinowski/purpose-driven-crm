

## Fix: Support ClickUp Automation Webhook Format

### Problem
ClickUp Automations send webhooks in a different format than ClickUp's native webhook system. The current code doesn't recognize this format.

**What we received:**
```json
{
  "auto_id": "4f7a53c1-...",
  "trigger_id": "f2c9f240-...",
  "payload": {
    "id": "868hczpbc",
    "name": "[DATABASE] Testing from the Hub",
    "status_id": "sc901113093436_pbrX12ce"
  }
}
```

**What the code expects:**
```javascript
payload.task_id  // undefined
payload.task?.id  // undefined
payload.history_items?.[0]?.parent_id  // undefined
```

---

### Solution

Update the `support-ticket-webhook` edge function to detect ClickUp Automation payloads and extract the task ID and status correctly.

---

### Changes to `supabase/functions/support-ticket-webhook/index.ts`

**1. Update task ID extraction to handle Automation format:**
```typescript
// Handle ClickUp Automation format (payload wrapped in "payload" object)
const isAutomationPayload = payload.auto_id && payload.trigger_id && payload.payload;
const taskData = isAutomationPayload ? payload.payload : payload;

const taskId = taskData.id || payload.task_id || payload.task?.id || payload.history_items?.[0]?.parent_id;
```

**2. For Automation payloads, extract status from status_id:**
Since Automation payloads include `status_id` but not the status name, we need to map it. Based on your ClickUp config:
- `sc901113093436_osIH6GQo` → "not started" → `open`
- `sc901113093436_fcd5I7DS` → "in progress" → `in_progress`  
- `sc901113093436_pbrX12ce` → "resolved" → `resolved`

```typescript
// Map ClickUp status IDs to Hub statuses (for Automation payloads)
function mapClickUpStatusIdToHub(statusId: string): 'open' | 'in_progress' | 'resolved' | null {
  const statusMap: Record<string, 'open' | 'in_progress' | 'resolved'> = {
    'sc901113093436_osIH6GQo': 'open',      // not started
    'sc901113093436_fcd5I7DS': 'in_progress', // in progress
    'sc901113093436_pbrX12ce': 'resolved',   // resolved
  };
  return statusMap[statusId] || null;
}
```

**3. Process Automation payloads for status updates:**
```typescript
if (isAutomationPayload && taskData.status_id) {
  const hubStatus = mapClickUpStatusIdToHub(taskData.status_id);
  if (hubStatus && hubStatus !== ticket.status) {
    updates.status = hubStatus;
    if (hubStatus === 'resolved') {
      updates.resolved_at = new Date().toISOString();
    }
  }
}
```

---

### Summary of Changes

| What | Change |
|------|--------|
| Detect Automation format | Check for `auto_id`, `trigger_id`, `payload` structure |
| Extract task ID | Use `payload.payload.id` for Automations |
| Extract status | Map `status_id` to Hub status values |
| Update ticket | Same logic, now works with both formats |

