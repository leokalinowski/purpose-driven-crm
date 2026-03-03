

## Plan: Fix Event Creation Not Refreshing UI

### Root Cause

`EventForm` (line 67) calls `useEvents()` independently, creating a **separate state instance** from the one in `Events.tsx`. When the form's `addEvent()` succeeds, it updates only the form's internal state — the parent page never sees the new event. The realtime subscription *should* catch it, but both instances register on the same channel name (`events-realtime`), which Supabase can deduplicate.

### Fix

Pass the parent's mutation functions and an `onSuccess` callback from `Events.tsx` into `EventForm` as props, so both components share the same state.

**File: `src/components/events/EventForm.tsx`**
- Add optional props: `addEventFn`, `updateEventFn`, `addEventAsAdminFn`, `updateEventAsAdminFn`, `onSuccess`
- When provided, use the parent's functions instead of the form's own `useEvents()` mutations
- After successful create/update, call `onSuccess(newEventId)` so the parent can auto-select the new event

**File: `src/pages/Events.tsx`**
- Pass the parent's `addEvent`, `updateEvent`, `addEventAsAdmin`, `updateEventAsAdmin` into `EventForm`
- Pass an `onSuccess` callback that calls `setSelectedEventId(newEventId)` to immediately show the new event and its tasks

### Changes

| File | Change |
|---|---|
| `src/components/events/EventForm.tsx` | Accept optional parent mutation functions + `onSuccess` callback; use them when provided |
| `src/pages/Events.tsx` | Pass mutation functions and `onSuccess` handler to `EventForm` |

