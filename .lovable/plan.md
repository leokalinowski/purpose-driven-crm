

# Fix Images in Toast & Banner Announcement Styles

## Problem
- **Toast**: Image only renders when user clicks "Read more" (`expanded && announcement.image_url` on line 59). Should show a compact thumbnail by default.
- **Banner**: No image rendering at all. Should show a small inline image/icon.

## Changes

### `src/components/announcements/AnnouncementModal.tsx`

**Toast** (lines 36-77):
- Always show a small thumbnail (max-h-24) when `image_url` exists, above the title
- Keep the expanded view for full-size image

**Banner** (lines 89-109):
- Add a small rounded image thumbnail (h-6 w-6) inline next to the icon when `image_url` exists

