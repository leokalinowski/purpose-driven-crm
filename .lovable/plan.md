

## Fix: Avg Attendance and Related Issues on Admin Events Management

### Root Cause

The `attendance_count` column on every event is **0** because there is no mechanism to populate it. The "Avg Attendance" stat card (line 239-241) computes the average from `attendance_count`, so it always shows **0**.

The same issue applies to `leads_generated` — also always 0.

### Proposed Changes

**1. Use confirmed RSVPs as attendance proxy for past events (code fix)**

Since there's no check-in workflow, the best proxy for attendance on past events is the confirmed RSVP count. Update the `calculateStats` function (line 239) to use `current_rsvp_count` for past events instead of the unpopulated `attendance_count`:

```ts
const avgAttendance = past > 0 
  ? pastEvents.reduce((sum, e) => sum + (e.attendance_count || e.current_rsvp_count || 0), 0) / past
  : 0;
```

This way attendance data takes priority if manually entered, but falls back to RSVP count.

**2. Same fallback in the Overview detail panel (line 816)**

Change the Attendance tile in the expanded event detail from:
```
{event.attendance_count || 0}
```
to:
```
{event.attendance_count || event.current_rsvp_count || 0}
```
And update the label to "Attendance / RSVPs" when using the fallback, so it's transparent.

**3. No other critical issues found**

The rest of the page (filters, table, detail tabs, CSV export, task stats, ClickUp sync) works correctly. The `leads_generated` column is also 0 everywhere, but that's a data-entry issue — there's no automatic source for it.

### Files Modified
- `src/pages/AdminEventsManagement.tsx` — 2 small changes to `calculateStats` and the overview detail tile

