

## Plan: Fix task status constraint + improve status UX

### Root Cause
The `event_tasks` table has a CHECK constraint:
```
CHECK (status = ANY (ARRAY['pending', 'completed', 'overdue']))
```
The code sends `'in_progress'` which violates this constraint, causing the 403-like error on every status toggle.

### Fix

**1. Database migration** -- Update the check constraint to include `'in_progress'`:
```sql
ALTER TABLE public.event_tasks DROP CONSTRAINT event_tasks_status_check;
ALTER TABLE public.event_tasks ADD CONSTRAINT event_tasks_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'overdue'::text]));
```

**2. No frontend changes needed** -- The status cycling UI (click icon to toggle To Do → In Progress → Done) already works in `SelfManagedTaskDashboard.tsx`. The `TaskEditForm` already has a Status dropdown. Once the constraint is fixed, everything will work.

### Files

| File | Action |
|---|---|
| Migration | **Create** -- alter check constraint to allow `in_progress` |

One migration, zero frontend changes.

