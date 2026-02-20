

# Fix: Remove Fallbacks That Override the Event Details Toggle

## The Problem

There are two issues causing the toggle to be unreliable:

1. **Race condition in `EmailTemplateEditor.tsx`**: The editor renders immediately with a fallback template (from `getDefaultEmailTemplate()`) before the saved template finishes loading from the database. The VisualEmailEditor initializes its toggle states from this fallback HTML. When the real template loads moments later, the parent updates `htmlContent`, but the VisualEmailEditor ignores it because its internal state is already set.

2. **Edge function hardcoded fallback**: The `event-email-scheduler` always includes event details in its last-resort fallback, even for thank_you and no_show emails.

## Changes

### 1. `src/components/events/email/EmailTemplateEditor.tsx`

- Add a loading guard: don't render the VisualEmailEditor until both `useEmailTemplates` and `useGlobalEmailTemplates` hooks have finished fetching. Show a simple loading spinner instead.
- Add a `key` prop to the VisualEmailEditor so React fully remounts it whenever the template source changes (e.g., switching email types). This guarantees the editor always initializes from the correct saved HTML.

### 2. `supabase/functions/event-email-scheduler/index.ts`

- Update the hardcoded fallback (lines 123-142) to skip event date/time/location for `thank_you` and `no_show` email types. These are post-event emails where including "this is a reminder for your event on [date]" doesn't make sense.

### 3. `src/utils/emailTemplateBuilder.ts`

- No changes needed. The `thank_you` and `no_show` default templates here already omit the Event Details card. The `confirmation` and `reminder_*` templates correctly include it.

## What This Fixes

- Toggle off "Show Event Details" on any email type, save, reload -- it stays off, guaranteed
- The edge function scheduler won't send post-event emails with date/time/location details as a last resort
- Switching between email types in the editor always shows the correct toggle states from the saved template

## Files Modified

| File | Change |
|---|---|
| `src/components/events/email/EmailTemplateEditor.tsx` | Add loading guard before rendering editor; add `key` prop to force remount on template change |
| `supabase/functions/event-email-scheduler/index.ts` | Remove event details from hardcoded fallback for thank_you and no_show types |
