

## Events Tab Fixes: Thank-You Emails, Walk-In Attendees, RSVP-to-Database Sync

### Problem Analysis

**1. Timothy's Thank-You Emails Failed**
The `event-reminder-email` Edge Function only handles `reminder_7day` and `reminder_1day` in its TypeScript interface. When `thank_you` or `no_show` is passed as `emailType`, the function still runs but has two critical bugs:
- It doesn't filter recipients by check-in status (sends to ALL confirmed RSVPs instead of only checked-in or not-checked-in)
- The email dedup logging hardcodes `event_reminder_7day` / `event_reminder_1day` regardless of actual type
- The `manual-send-event-email` function references non-existent `event-thank-you-email` and `event-no-show-email` functions

**2. No way to add walk-in attendees (showed up but didn't RSVP)**
There's no UI or mechanism to manually add attendees who walked in without RSVPing.

**3. RSVPs not automatically added to agent's contact database**
The `submit_public_rsvp` RPC inserts into `event_rsvps` but never checks or creates a record in the `contacts` table.

---

### Plan

#### Fix 1: Fix Thank-You / No-Show email sending in `event-reminder-email`

**File: `supabase/functions/event-reminder-email/index.ts`**
- Expand the `EmailRequest` interface to accept `'thank_you' | 'no_show'` in addition to reminder types
- Add recipient filtering: `thank_you` → only `check_in_status = 'checked_in'`; `no_show` → only `check_in_status != 'checked_in'`
- Fix the email log type to use the actual `emailType` instead of hardcoded reminder types
- Deploy the updated function

**File: `supabase/functions/manual-send-event-email/index.ts`**
- Fix `thank_you` and `no_show` cases to route to `event-reminder-email` (which now supports them) instead of non-existent functions
- Deploy the updated function

#### Fix 2: Add "Walk-In Attendee" feature to RSVP Management

**File: `src/components/events/RSVPManagement.tsx`**
- Add an "Add Walk-In" button that opens a dialog/form
- Form fields: Name, Email, Phone (optional), Guest Count
- On submit: insert directly into `event_rsvps` with `status: 'confirmed'` and `check_in_status: 'checked_in'` (they're already there)
- Uses a new `addWalkInAttendee` function in the RSVP hook

**File: `src/hooks/useRSVP.ts`**
- Add `addWalkInAttendee(eventId, formData)` method that inserts an RSVP record marked as checked-in
- This requires auth (agent only), so uses the authenticated client

#### Fix 3: Auto-add RSVPs to agent's contact database

**New Edge Function or DB trigger approach:**
- Create a database trigger on `event_rsvps` INSERT that automatically upserts into the `contacts` table
- The trigger will look up the event's `agent_id`, then insert into `contacts` with the RSVP's name/email/phone if no matching contact exists for that agent
- Uses `ON CONFLICT` on `(agent_id, email)` to avoid duplicates — if the contact already exists, skip

**Database migration:**
- Create a trigger function `sync_rsvp_to_contacts()` that fires on INSERT to `event_rsvps`
- Joins `events` to get `agent_id`, then upserts into `contacts` with `lead_source = 'Event RSVP'`

---

### Technical Details

**Trigger function for RSVP → Contacts sync:**
- SECURITY DEFINER to bypass RLS
- Splits RSVP `name` into `first_name` / `last_name`
- Sets `lead_source` to `'Event RSVP'` and tags with the event title
- Only inserts if no existing contact with same email + agent_id exists (preserves existing data)

**Walk-in attendee insertion:**
- Inserts via authenticated Supabase client (agent must be logged in)
- Sets `check_in_status = 'checked_in'` and `checked_in_at = now()` immediately
- Also triggers the same contacts sync trigger automatically

**Email function fix:**
- The `event-reminder-email` function already has the template resolution and sending logic — it just needs the recipient filtering added for thank_you/no_show types

