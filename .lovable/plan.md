

# Fix Image Upload, Add Action URL Picker & Multi-Slide Support

## 1. Fix Image Upload (Storage Policy)

**Root cause**: The `assets` bucket has zero RLS policies — no INSERT, no SELECT, nothing. Uploads are blocked by RLS.

**Fix**: Add storage policies for the `assets` bucket:
- Admin INSERT policy (only admins upload announcement images)
- Public SELECT policy (the bucket is already marked public, but needs an RLS SELECT policy to actually serve files)

## 2. Action URL — Page Picker Dropdown

Replace the free-text Action URL input with a Select dropdown listing all app routes, plus a "Custom URL" option for external links.

Routes to include:
| Label | Value |
|-------|-------|
| Dashboard | `/` |
| SphereSync Tasks | `/spheresync-tasks` |
| Database | `/database` |
| Events | `/events` |
| Newsletter | `/newsletter` |
| Coaching | `/coaching` |
| Transactions | `/transactions` |
| Pipeline | `/pipeline` |
| Social Scheduler | `/social-scheduler` |
| Support | `/support` |
| Newsletter Builder | `/newsletter-builder` |
| Custom URL... | (shows text input) |

When "Custom URL" is selected, a text input appears for pasting an external link.

## 3. Multi-Slide Support

**Database**: Add a `slides` JSONB column to the `announcements` table (nullable, default null). Each slide is an object: `{ title, content, image_url }`. When `slides` is null, the announcement behaves as a single-slide announcement (backward compatible).

**Admin form**: Add a "Slides" section below the main content area:
- Toggle: "Multi-slide walkthrough"
- When enabled, shows a list of slide cards with title, content, and image upload for each
- Add/remove slide buttons
- The main title/content become the "intro slide"

**Modal**: When `slides` exists and has items, render them as additional pages after the main content, using the existing pagination dots.

## Files to Change

| File | Change |
|------|--------|
| New migration | Add storage policies for `assets` bucket; add `slides` JSONB column to `announcements` |
| `src/pages/AdminAnnouncements.tsx` | Replace action URL input with page picker; add slide builder UI |
| `src/components/announcements/AnnouncementModal.tsx` | Render slides from the `slides` field as extra pages |
| `src/components/announcements/announcementConstants.ts` | Add `APP_PAGES` constant for the route picker |

