

## Fix NewsletterTaskCard Styling to Match Brand

The card currently uses orange tones that clash with the teal brand. It also has a heavy beige appearance in the screenshot. The fix is straightforward — swap orange for the app's primary teal palette, and use a cleaner, lighter card style.

### Changes — `src/components/newsletter/NewsletterTaskCard.tsx`

**When due (not complete):**
- Border: `border-l-primary` (teal) instead of `border-l-orange-500`
- Background: `bg-primary/5` (subtle teal tint) instead of `bg-orange-50/50`
- Icon circle: `bg-primary/10` with `text-primary` instead of orange
- Badge: teal-styled outline badge instead of orange

**When complete:**
- Keep green — it's universally understood as "done"

**When not due:**
- Clean default card with muted border

This aligns the card with the teal design system used throughout the app (sidebar, buttons, headings).

### File
- `src/components/newsletter/NewsletterTaskCard.tsx` — Replace all orange color references with primary/teal equivalents

