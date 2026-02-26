

# Announcement Positioning, Styles & Extended Types

## Database Change

Add two new columns to `announcements`:

| Column | Type | Default | Values |
|--------|------|---------|--------|
| `display_position` | text | `'center'` | `center`, `top-right`, `top-left`, `bottom-right`, `bottom-left` |
| `display_style` | text | `'modal'` | `modal` (current full dialog), `toast` (compact notification card), `banner` (slim top/bottom bar) |

## New Announcement Types

Expand `typeConfig` in `announcementConstants.ts`:

| Type | Label | Use Case |
|------|-------|----------|
| `feature` | New Feature | System updates |
| `update` | Update | General updates |
| `tip` | Tip | Usage tips |
| `strategy` | Strategy | New business strategies |
| `meeting` | Meeting | Meeting changes/reminders |
| `announcement` | Announcement | General company announcements |

## AnnouncementModal Rendering

Based on `display_style` and `display_position`, render three different layouts:

- **`modal`** (current behavior): Centered dialog, ignores position. Full content with slides.
- **`toast`**: Compact card positioned absolutely in the chosen corner. Smaller, less intrusive. Shows title + short content + dismiss button. Expands on click to show full content.
- **`banner`**: Slim horizontal bar at top or bottom of screen. Single line with title, dismiss X. Position only uses top vs bottom (top-left/top-right → top, bottom-left/bottom-right → bottom).

Implementation: Replace the single `<Dialog>` with conditional rendering. Toast uses a fixed-position card with Tailwind positioning classes. Banner uses a fixed bar. Modal stays as-is.

## Admin Form Updates

Add two new Select dropdowns in the create/edit form:
- **Display Style**: Modal / Toast / Banner
- **Position**: Center / Top-Right / Top-Left / Bottom-Right / Bottom-Left (disabled options grayed out when not applicable to the chosen style)

## Files to Change

| File | Change |
|------|--------|
| New migration | Add `display_position` and `display_style` columns |
| `announcementConstants.ts` | Add new types (strategy, meeting, announcement), add position/style constants |
| `useAnnouncements.ts` | Update `Announcement` interface with new fields |
| `AnnouncementModal.tsx` | Rewrite to render modal/toast/banner based on style+position |
| `AdminAnnouncements.tsx` | Add style and position selectors to form, update preview |

