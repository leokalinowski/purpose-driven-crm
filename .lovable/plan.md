

# Add Wednesday Afternoon Coaching Reminder

## Current State
- A cron job for **Wednesday at 1:00 PM ET** (job 6) already exists in `pg_cron` but it's blocked by the idempotency logic.
- A cron job for **Thursday at 8:30 AM ET** (job 13) also exists and works correctly.
- The edge function checks `coaching_reminder_logs` for an existing row matching `(agent_id, week_number, year)`. Since there's no distinction between Wednesday vs Thursday, whichever runs first blocks the other.

## Plan

### 1. Add `reminder_type` column to `coaching_reminder_logs`
Add a nullable text column `reminder_type` (values: `'wednesday'`, `'thursday'`) with a default of `'thursday'` so existing rows remain valid.

### 2. Update the edge function to accept and use `reminder_type`
- Read `reminder_type` from the request body (default `'thursday'`).
- Include `reminder_type` in the idempotency check so Wednesday and Thursday reminders are tracked independently.
- Include `reminder_type` in log inserts.
- Slightly adjust the Wednesday email copy (e.g., "before Thursday's coaching session" instead of "before tomorrow's").

### 3. Update the Wednesday cron job body
The existing cron job (job 6) needs its body updated to include `"reminder_type": "wednesday"` and `"source": "cron"`, plus the required `X-Cron-Job: true` header (currently missing).

### 4. Fix the Thursday cron job
Job 13 is also missing the `X-Cron-Job` header and doesn't pass `source: "cron"` properly. We'll fix that too while we're at it.

---

## Technical Details

### Migration SQL
```sql
ALTER TABLE coaching_reminder_logs
ADD COLUMN reminder_type text DEFAULT 'thursday';
```

### Edge Function Changes (`supabase/functions/coaching-reminder/index.ts`)

**Read reminder_type from body:**
```ts
const reminderType = requestBody.reminder_type || 'thursday';
```

**Idempotency check (lines 51-57) -- add filter:**
```ts
.eq('reminder_type', reminderType)
```

**Log inserts -- include reminder_type:**
```ts
{ ..., reminder_type: reminderType }
```

**Email copy adjustment:**
- If `reminderType === 'wednesday'`: "...submit your Weekly Success Scoreboard before Thursday's coaching Zoom session."
- If `reminderType === 'thursday'`: "...submit your Weekly Success Scoreboard before today's coaching Zoom session."

### Cron Job Updates (run via SQL, not migration)

**Drop and recreate Wednesday job (job 6):**
```sql
SELECT cron.unschedule(6);
SELECT cron.schedule(
  'coaching-reminder-wednesday',
  '0 18 * * 3',
  $$
  SELECT net.http_post(
    url:='https://cguoaokqwgqvzkqqezcq.supabase.co/functions/v1/coaching-reminder',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer <ANON_KEY>", "X-Cron-Job": "true"}'::jsonb,
    body:='{"source": "cron", "reminder_type": "wednesday"}'::jsonb
  ) as request_id;
  $$
);
```

**Drop and recreate Thursday job (job 13):**
```sql
SELECT cron.unschedule(13);
SELECT cron.schedule(
  'coaching-reminder-thursday',
  '30 13 * * 4',
  $$
  SELECT net.http_post(
    url:='https://cguoaokqwgqvzkqqezcq.supabase.co/functions/v1/coaching-reminder',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer <ANON_KEY>", "X-Cron-Job": "true"}'::jsonb,
    body:='{"source": "cron", "reminder_type": "thursday"}'::jsonb
  ) as request_id;
  $$
);
```

### Summary of Changes
| What | Action |
|------|--------|
| `coaching_reminder_logs` table | Add `reminder_type` column |
| `coaching-reminder` edge function | Accept `reminder_type`, use in idempotency + logs, adjust email copy |
| Wednesday cron job (job 6) | Recreate with correct headers and `reminder_type: "wednesday"` |
| Thursday cron job (job 13) | Recreate with correct headers and `reminder_type: "thursday"` |

