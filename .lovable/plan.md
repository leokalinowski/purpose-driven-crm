

## Fix: Avg Attendance Showing 0 (Not Reading Check-In Data)

### Root Cause

The `attendance_count` column on the `events` table is always 0 — it is never updated when guests are checked in. The actual attendance data lives in the `event_rsvps` table (`check_in_status = 'checked_in'`). For example, Purge & Perk has 16 checked-in guests but `attendance_count = 0`.

The admin page reads `e.attendance_count || e.current_rsvp_count` which always returns 0 for attendance, falling back to RSVP count.

### Solution

Two changes:

**1. Create a database trigger to keep `attendance_count` in sync**

Add a trigger on `event_rsvps` that updates `events.attendance_count` whenever `check_in_status` changes — same pattern as the existing `update_event_rsvp_count` trigger that keeps `current_rsvp_count` in sync.

**2. Backfill existing data**

Run a one-time SQL update to set `attendance_count` for all events based on current check-in data:

```sql
UPDATE events e
SET attendance_count = (
  SELECT COUNT(*)
  FROM event_rsvps r
  WHERE r.event_id = e.id
  AND r.check_in_status = 'checked_in'
);
```

### What changes

| File / Asset | Change |
|---|---|
| New migration | Trigger `update_event_attendance_count` on `event_rsvps` + backfill query |
| No app code changes | The admin page already reads `attendance_count` correctly — it just needs the column to be populated |

### After this

- Purge & Perk will show attendance = 16
- Right Sizing will show attendance = 8
- The Real Estate Scholarship will show attendance = 3
- Avg Attendance card will compute correctly across past events
- Future check-ins will automatically update the count via the trigger

