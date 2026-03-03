

## Plan: Fix Color Pickers + Rewrite Default Email Copy

### Issue 1: Color pickers show default blue instead of agent's branding

**Root cause**: `EmailTemplateEditor` has `eventData` with `primary_color` and `secondary_color` from the agent's marketing settings, but it never passes them to `VisualEmailEditor`. The `VisualEmailEditor` component has no prop for agent colors, so `getDefaultData()` always returns `#2563eb` / `#1e40af`.

**Fix**:
- Add an optional `agentColors` prop (`{ primary: string, secondary: string }`) to `VisualEmailEditor`
- Pass `eventData.primary_color` and `eventData.secondary_color` from `EmailTemplateEditor` into this new prop
- In `getDefaultData()`, use the agent colors when provided instead of the hardcoded defaults
- The color pickers will then initialize with the agent's actual branding colors

**Files**: `VisualEmailEditor.tsx` (add prop, update defaults), `EmailTemplateEditor.tsx` (pass colors)

---

### Issue 2: Rewrite default email copy for all types

Update `DEFAULT_HEADINGS` and `DEFAULT_PARAGRAPHS` in `VisualEmailEditor.tsx`:

**Invitation** — more enticing, clear RSVP ask:
- Heading: "You're Invited! ✉️"
- Copy: Warm opening, sell the event value, clear call to RSVP with urgency ("Spots are limited")

**Confirmation** — keep as-is (user confirmed it's good)

**7-Day Reminder** — motivate attendance:
- Heading: "Just One Week Away! 📅"
- Copy: Build excitement, remind them why they RSVP'd, mention what they'd miss

**1-Day Reminder** — urgency + logistics:
- Heading: "See You Tomorrow! ⏰"
- Copy: Excitement, quick logistics reminder, "we saved your spot"

**Thank You** — invite to 1-on-1:
- Heading: "Thank You for Joining Us! 🙏"
- Copy: Gratitude, mention highlights, invite them to schedule a personal conversation

**No-Show** — warm re-engagement + 1-on-1 invite:
- Heading: "We Missed You! 💌"
- Copy: No guilt, share what they missed briefly, invite to connect 1-on-1 instead

**Files**: `VisualEmailEditor.tsx` (update `DEFAULT_PARAGRAPHS` and some `DEFAULT_HEADINGS`)

---

### Summary

| File | Change |
|---|---|
| `src/components/events/email/VisualEmailEditor.tsx` | Add `agentColors` prop; update `getDefaultData` to use them; rewrite all default email copy |
| `src/components/events/email/EmailTemplateEditor.tsx` | Pass `eventData.primary_color` / `secondary_color` to `VisualEmailEditor` |

