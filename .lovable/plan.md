

# In-App Announcements & Feature Tour System

## Concept

A system where admins create announcements (new features, tips, how-tos) that appear as a modal/dialog when agents log in. Agents can dismiss them, and they won't see the same announcement twice. Optionally, announcements can include step-by-step slides for feature walkthroughs.

## Database

### New table: `announcements`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | |
| `title` | text | Headline |
| `content` | text | Rich description / markdown |
| `type` | text | `'feature'`, `'update'`, `'tip'` |
| `image_url` | text (nullable) | Screenshot or GIF |
| `action_url` | text (nullable) | "Try it now" link |
| `action_label` | text (nullable) | Button text |
| `is_active` | boolean | Toggle visibility |
| `priority` | integer | Sort order |
| `target_role` | text (nullable) | `'agent'`, `'admin'`, or null for all |
| `created_at` | timestamptz | |
| `expires_at` | timestamptz (nullable) | Auto-hide after date |
| `created_by` | uuid | Admin who created it |

### New table: `announcement_dismissals`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | |
| `announcement_id` | uuid (FK) | |
| `user_id` | uuid | |
| `dismissed_at` | timestamptz | |

Unique constraint on `(announcement_id, user_id)` so each user can only dismiss once.

RLS: Agents can read active announcements and insert/read their own dismissals. Admins can CRUD announcements.

## Frontend Components

### 1. `AnnouncementModal` (new component)
- Shown inside `Layout.tsx` after login
- Queries `announcements` where `is_active = true` and no matching row in `announcement_dismissals` for the current user
- Renders as a dialog with: title, optional image/GIF, content text, optional CTA button, and a "Got it" dismiss button
- If multiple announcements exist, shows them as paginated slides (dots at bottom, next/prev)
- On dismiss, inserts into `announcement_dismissals`

### 2. Admin Announcements Page (new page at `/admin/announcements`)
- Form to create/edit announcements: title, content, type badge, image URL, action URL, target role, expiry date
- List of all announcements with toggle for `is_active`
- Preview of how it will look to agents

### 3. Sidebar link
- Add "Announcements" under the admin menu in `AppSidebar.tsx`

## Hook: `useAnnouncements`
- Fetches un-dismissed, active, non-expired announcements for the current user
- Provides `dismissAnnouncement` mutation
- Admin version fetches all announcements for management

## Files to Create/Modify

| File | Action |
|------|-------|
| DB migration | Create `announcements` and `announcement_dismissals` tables with RLS |
| `src/hooks/useAnnouncements.ts` | New hook |
| `src/components/announcements/AnnouncementModal.tsx` | New modal component |
| `src/pages/AdminAnnouncements.tsx` | New admin page |
| `src/components/layout/Layout.tsx` | Add `AnnouncementModal` |
| `src/components/layout/AppSidebar.tsx` | Add admin menu link |
| `src/App.tsx` | Add route `/admin/announcements` |

## No new dependencies needed
Uses existing Dialog, Badge, Button, and form components.

