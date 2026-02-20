
# Add "Show Event Details" Toggle for Post-Event Emails

## Cron Job Status
The cron job is correctly configured:
- **Schedule**: `0 14 * * *` (2:00 PM UTC / 10:00 AM ET daily)
- **Target**: `event-email-scheduler` edge function
- **Headers**: Includes `X-Cron-Job: true` and proper auth -- all good.

## The Event Details Toggle

Right now, the Visual Email Editor always includes the "Event Details Card" (date, time, location, description) in every email type. For post-event emails (Thank You and No-Show), this feels unnecessary since the event already happened.

### What Changes

**`src/components/events/email/VisualEmailEditor.tsx`**

1. Add a new toggle to `VisualEditorData`: `showEventDetails: boolean`
2. Default it based on email type:
   - `thank_you` and `no_show` default to **off**
   - All other types (confirmation, reminder_7day, reminder_1day, invitation) default to **on**
3. Replace the static "always included" info box (lines 217-222) with a toggleable switch
4. In `dataToHtml()`, wrap the Event Details Card HTML in a conditional so it's only included when `showEventDetails` is true

### Visual Change in the Editor

Currently shows:
> "Event Details Card -- Automatically shows date, time, location, and description using event data. Always included."

Will become a toggle:
> [Toggle] **Show Event Details** -- Include date, time, location, and description card

When toggled off for Thank You / No-Show emails, the generated HTML simply omits the entire event details section, resulting in a cleaner post-event message.

## Technical Details

| File | Change |
|---|---|
| `src/components/events/email/VisualEmailEditor.tsx` | Add `showEventDetails` to data interface, toggle UI, conditional in `dataToHtml()` |

The edge function fallback templates (`event-email-scheduler`) already have simple hardcoded templates for thank_you and no_show that include event details. Since those are only used when no event-specific template exists, and the visual editor is the primary way templates are created, this toggle gives full control. The fallback templates are intentionally kept simple and left as-is.
