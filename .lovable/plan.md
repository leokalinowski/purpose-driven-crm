

# Fix: Event Times Showing Wrong in Emails (Timezone Bug)

## The Problem
When you create an event at 11:00 AM, the email says 7:00 AM. That's a 4-hour difference -- exactly the Eastern Daylight Time offset from UTC.

## Root Cause
In `EventForm.tsx` (line 263), when saving an event, the code appends `Z` to the time:
```
"2026-03-14T11:00:00.000Z"
```
The `Z` means "this is UTC time." But the user meant 11:00 AM **local time**, not 11:00 AM in London. So the database stores the wrong absolute time.

Then in the email edge functions (`event-reminder-email`, `rsvp-confirmation-email`), the code does:
```
new Date(event.event_date).toLocaleTimeString(...)
```
This interprets the stored UTC time in whatever timezone the server uses, producing "7:00 AM" (Eastern) instead of 11:00 AM.

## The Fix

The simplest and most reliable approach: **treat event times as "wall clock" times** -- the time the user typed is the time that should display everywhere. No timezone conversion at all.

### 1. Frontend: Stop marking the time as UTC (EventForm.tsx)

Change the save line from:
```
const eventDateTime = `${eventDate}T${hours}:${minutes}:00.000Z`;
```
to:
```
const eventDateTime = `${eventDate}T${hours}:${minutes}:00`;
```

Remove the `Z` suffix. This stores the time as a **local/unqualified timestamp**, so "11:00" stays "11:00" regardless of timezone.

### 2. Edge Functions: Parse time from the string, not from Date object

In all three email edge functions, replace the `new Date()` + `toLocaleTimeString()` pattern with direct string parsing:

**Before (broken):**
```typescript
const eventDate = new Date(event.event_date);
const formattedDate = eventDate.toLocaleDateString('en-US', { ... });
const formattedTime = eventDate.toLocaleTimeString('en-US', { ... });
```

**After (reliable):**
```typescript
const dateTimeParts = event.event_date.split('T');
const datePart = dateTimeParts[0]; // "2026-03-14"
const timePart = dateTimeParts[1]?.substring(0, 5) || '00:00'; // "11:00"

// Parse date components to avoid timezone shift
const [year, month, day] = datePart.split('-').map(Number);
const months = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
const weekdays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const dateObj = new Date(year, month - 1, day);
const formattedDate = `${weekdays[dateObj.getDay()]}, ${months[month-1]} ${day}, ${year}`;

// Parse time directly from the string
const [h, m] = timePart.split(':').map(Number);
const ampm = h >= 12 ? 'PM' : 'AM';
const hour12 = h % 12 || 12;
const formattedTime = `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
```

This ensures "11:00" in the database always becomes "11:00 AM" in every email, on every server, in every timezone.

### 3. Frontend displays: Apply same string-based parsing

Update these files to use string parsing instead of `new Date()`:
- `EventCard.tsx` -- date display
- `EventsWidget.tsx` -- date display
- `EmailTemplateEditor.tsx` -- preview rendering
- `RSVPConfirmation.tsx` -- confirmation display

The `EventPublicHeader.tsx` already does string-based parsing correctly, so it needs no change.

## Files to Modify

| File | Change |
|---|---|
| `src/components/events/EventForm.tsx` | Remove `Z` from datetime string |
| `supabase/functions/event-reminder-email/index.ts` | String-based date/time parsing |
| `supabase/functions/rsvp-confirmation-email/index.ts` | String-based date/time parsing |
| `src/components/events/EventCard.tsx` | String-based date display |
| `src/components/events/EventsWidget.tsx` | String-based date display |
| `src/components/events/email/EmailTemplateEditor.tsx` | String-based preview time |
| `src/components/events/rsvp/RSVPConfirmation.tsx` | String-based confirmation time |

## Existing Data Fix
The event already in the database (`2026-03-14 11:00:00+00`) is stored as UTC. Since the user intended 11:00 AM local, the stored value happens to have the right digits. Once we stop treating it as UTC and start parsing the string directly, it will display correctly without needing a data migration.

