
# Fix RSVP Button in Preview and "Send Now" Error

## Issue 1: RSVP Button Missing in Email Preview

**Root cause**: The Visual Email Editor (`VisualEmailEditor.tsx`) generates the email HTML via the `dataToHtml` function. This function outputs header images, heading, body paragraphs, event details card, host info, and footer -- but it never generates an RSVP/CTA button. So the preview shows no button.

The actual sent email works if the saved template was manually edited in HTML mode to include a button, but the visual editor can't produce one.

**Fix**: Add an RSVP CTA button block to `dataToHtml` in `VisualEmailEditor.tsx`, placed between the body paragraphs and the event details card. The button links to `{rsvp_link}` and uses the primary color. A toggle (`showRsvpButton`) will be added to `VisualEditorData` so it can be turned on/off -- defaulting to ON for `invitation` and `confirmation` types.

### Changes in `src/components/events/email/VisualEmailEditor.tsx`:
- Add `showRsvpButton: boolean` to the `VisualEditorData` interface
- Add `rsvpButtonText: string` to the interface (default: "RSVP Now" for invitation, "View Event Details" for others)
- Default `showRsvpButton` to `true` for invitation/confirmation types
- Add a toggle + text input in the visual editor UI under the body paragraphs section
- In `dataToHtml`, generate a styled CTA button linking to `{rsvp_link}` when enabled
- In `parseHtmlToData`, detect existing `{rsvp_link}` buttons

## Issue 2: "Send Now" Returns "Event not found"

**Root cause**: The `send-event-invitation` edge function queries the event with a foreign key join:
```
profiles:agent_id (first_name, last_name, ...)
```
But there is **no foreign key constraint** between `events.agent_id` and `profiles.user_id`. Without that FK, Supabase cannot resolve the join and the query returns an error. The code treats any error as "Event not found."

**Fix**: Change the edge function to query events and profiles separately (two queries), matching the pattern already used in `EmailManagement.tsx`. This avoids the FK dependency entirely.

### Changes in `supabase/functions/send-event-invitation/index.ts`:
- Split the single joined query into two separate queries:
  1. Fetch the event: `supabase.from('events').select('*').eq('id', eventId).single()`
  2. Fetch the agent profile: `supabase.from('profiles').select('...').eq('user_id', event.agent_id).single()`
- Attach the profile data to the event object manually (as `event.profiles`)
- Rest of the function logic remains unchanged

## Files Modified

| File | Change |
|---|---|
| `src/components/events/email/VisualEmailEditor.tsx` | Add RSVP CTA button to visual editor and generated HTML |
| `supabase/functions/send-event-invitation/index.ts` | Split joined query into two separate queries to avoid missing FK |
