

## Plan: Replace Automated Post-Event Emails with Task-Based Reminders

### Problem

Thank-you and no-show emails depend on check-in status being confirmed by the agent first. If the scheduler fires automatically at `diffDays === -1`, the agent may not have updated check-in statuses yet, leading to wrong recipients getting the wrong email.

### Solution

Instead of the scheduler automatically sending `thank_you` and `no_show` emails, it will create `event_tasks` entries reminding the agent to:
1. Confirm check-in attendance
2. Send thank-you emails (manually via the Emails tab)
3. Send no-show follow-up emails (manually via the Emails tab)

The manual send buttons for thank-you and no-show already exist in the EmailManagement UI, so the agent just needs to be prompted to use them after confirming attendance.

### Changes

| File | Change |
|------|--------|
| `supabase/functions/event-email-scheduler/index.ts` | Remove `thank_you` and `no_show` from `emailTypesToSend`. Instead, when `diffDays === -1`, insert 3 `event_tasks` for the agent: "Confirm Event Attendance", "Send Thank-You Emails", "Send No-Show Follow-Up Emails" (with dedup check to avoid duplicate tasks) |
| `src/utils/defaultEventTasks.ts` | Update the existing "Send Thank-You Email" task (day +1) to have a note clarifying the workflow. Add a "Confirm Event Attendance" task at day +1 and a "Send No-Show Follow-Up Emails" task at day +2 |

### Scheduler Logic Change

```text
// BEFORE (diffDays === -1):
emailTypesToSend.push('thank_you')
emailTypesToSend.push('no_show')

// AFTER (diffDays === -1):
// Create tasks instead of sending emails
INSERT INTO event_tasks:
  1. "Confirm Event Attendance" (due: event_date + 1 day)
  2. "Send Thank-You Emails via Emails Tab" (due: event_date + 1 day)  
  3. "Send No-Show Follow-Up Emails via Emails Tab" (due: event_date + 2 days)
// Dedup: skip if tasks with these names already exist for this event
```

### Default Tasks Update

Replace the single "Send Thank-You Email" post-event task with a clearer 3-step sequence:
- Day +1: "Confirm Event Attendance" (responsible: Event Coordinator)
- Day +1: "Send Thank-You Emails" (responsible: Marketing) — already exists, keep as-is
- Day +2: "Send No-Show Follow-Up Emails" (responsible: Marketing) — new

### Files to Modify

- `supabase/functions/event-email-scheduler/index.ts` — remove auto-send of post-event emails, add task creation logic
- `src/utils/defaultEventTasks.ts` — add "Confirm Event Attendance" and "Send No-Show Follow-Up Emails" tasks

