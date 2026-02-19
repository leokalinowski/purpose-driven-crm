

# Fix: ClickUp Tasks Not Filtering by Selected Event

## Problem
When you expand an event row and click the "ClickUp Tasks" sub-tab, the `AdminEventTasks` component fetches **all** tasks from the `clickup_tasks` table and defaults the event filter dropdown to "All Events". This shows all 188 tasks instead of only tasks for the selected event.

## Root Cause
In `src/components/admin/AdminEventTasks.tsx`:
- `fetchTasks()` queries `clickup_tasks` with no `.eq('event_id', ...)` filter
- `eventFilter` state defaults to `'all'`
- The component ignores the fact that it's being passed a single event

## Fix
**File: `src/components/admin/AdminEventTasks.tsx`**

Two changes:

1. **Auto-set the event filter when only one event is passed**: Initialize `eventFilter` from the `events` prop. When `events.length === 1`, default to that event's ID instead of `'all'`.

2. **Filter the database query itself**: When a specific event is selected, add `.eq('event_id', eventId)` to the Supabase query so we don't fetch 188 rows unnecessarily.

### Specific Code Changes

**Change 1 — Initialize filter from props (around line 50)**
```typescript
// Before
const [eventFilter, setEventFilter] = useState<string>('all');

// After
const [eventFilter, setEventFilter] = useState<string>(
  events.length === 1 ? events[0].id : 'all'
);
```

**Change 2 — Filter the query (around line 53-58)**
```typescript
// Before
const { data, error } = await supabase
  .from('clickup_tasks')
  .select('*')
  .order('due_date', { ascending: true });

// After
let query = supabase
  .from('clickup_tasks')
  .select('*')
  .order('due_date', { ascending: true });

if (eventFilter !== 'all') {
  query = query.eq('event_id', eventFilter);
}

const { data, error } = await query;
```

**Change 3 — Re-fetch when eventFilter changes (line 68-70)**
```typescript
// Before
useEffect(() => {
  fetchTasks();
}, []);

// After
useEffect(() => {
  fetchTasks();
}, [eventFilter]);
```

**Change 4 — Sync filter when events prop changes**
Add an effect to update the filter if the parent passes a different event:
```typescript
useEffect(() => {
  if (events.length === 1) {
    setEventFilter(events[0].id);
  }
}, [events]);
```

**Change 5 — Hide the "All Events" dropdown when only one event is passed**
When `events.length === 1`, the event selector is redundant. Hide it or disable it so the UI is cleaner.

These changes ensure that when the detail panel opens for a specific event, only that event's tasks are fetched and displayed.
