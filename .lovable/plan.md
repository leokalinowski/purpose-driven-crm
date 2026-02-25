

# Improve Template List Visual Design

Looking at the screenshot, the template card layout has several issues: the thumbnail only fills half the card width, there's excess whitespace, and the overall layout feels sparse and left-heavy. Here's the plan to make it cleaner and more polished.

## Changes

### 1. TemplateList.tsx - Card Layout Overhaul

**Thumbnail**: The current iframe container is `h-36` with a 640px iframe scaled at 0.28 -- this only fills about 180px of horizontal space, leaving the right half of the card blank. Fix by centering the iframe and making the thumbnail container taller (`h-48`) with the iframe centered horizontally.

**Card structure**: Move the name and date below the thumbnail for a cleaner vertical flow (image on top, info below, actions at bottom). This is a standard gallery-card pattern.

**Actions**: Make the action buttons more compact and visually balanced. Keep the Edit button prominent, but tighten spacing.

**Grid**: Change from `sm:grid-cols-2 lg:grid-cols-3` to a max-width centered container so cards don't stretch too wide on large screens. Use `max-w-4xl mx-auto` on the grid.

**Header section**: Center the "Email Templates" header and "New Template" button within the same max-width container.

### 2. Specific CSS/Layout Changes

- Thumbnail container: `h-48` instead of `h-36`, add `flex items-center justify-center` so the scaled iframe is centered
- iframe scale: increase from `0.28` to `0.35` so the preview is larger and more readable
- Card: add `overflow-hidden` and move thumbnail outside `CardContent` so it sits flush at the top with no padding
- Name/date: place below thumbnail inside a padded area
- Actions: use `border-t` separator above the action row for visual clarity
- Wrap everything in `max-w-4xl mx-auto` for better centering on wide screens

## Files to Modify

| File | Change |
|---|---|
| `src/components/newsletter/builder/TemplateList.tsx` | Restructure card layout: thumbnail on top (flush, centered, larger), info below, actions at bottom with separator. Wrap grid in centered max-width container. |

