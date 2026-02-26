

# Announcement System Review

## Bugs Found

### 1. Modal crashes after dismissing announcements (index out of bounds)
When "Got it" is clicked, `handleDismiss` dismisses the current announcement, which triggers a query invalidation. The `announcements` array shrinks, but `currentIndex` may now point past the end. For example: 3 announcements, viewing index 1, dismiss it -- array becomes length 2, but `currentIndex` is still 1 pointing to what was previously item 2. If you're on the last item and dismiss it, `setCurrentIndex(0)` runs, but the stale `announcements` array is used in the check. This causes the component to briefly render with `current = undefined`, crashing.

**Fix**: Add a guard `if (!current) return null` after the array access, and use optimistic removal from the local state instead of relying on query invalidation timing.

### 2. Closing the dialog (X button or Escape) dismisses ALL announcements
`onOpenChange={() => handleDismissAll()}` means pressing Escape or clicking the X permanently dismisses every announcement. Users who just want to close and come back later lose all announcements forever.

**Fix**: Change `onOpenChange` to only close the modal visually (e.g. set a local `isOpen` state to false), not dismiss. Only "Got it" should dismiss.

### 3. handleDismissAll fires sequential mutations with invalidations
The loop `for (const a of announcements) { await dismissAnnouncement.mutateAsync(a.id) }` invalidates the query after each mutation, causing the array to change mid-loop. Later iterations may reference stale data.

**Fix**: Either batch the dismissals or suppress query invalidation during the loop.

## Security Issues

### 4. Announcements SELECT policy is open to anonymous users
The policy `USING (is_active = true)` has no `TO authenticated` clause, meaning unauthenticated/anonymous users can read all active announcements.

**Fix**: Add `TO authenticated` to the policy.

### 5. Dismissals table has no admin delete policy
If an admin deletes an announcement, the CASCADE handles dismissals. But admins can't manually clean up orphaned dismissals if needed.

**Fix**: Add an admin DELETE policy on `announcement_dismissals`.

## UX Improvements

### 6. No delete confirmation
The trash button immediately deletes with no confirmation. Easy to accidentally destroy an announcement.

**Fix**: Add an AlertDialog confirmation before delete.

### 7. No image upload -- admins must paste URLs
The image field only accepts a URL. Admins would need to upload images elsewhere and paste the link.

**Fix**: Add a file upload button that uploads to the existing `assets` storage bucket and populates the URL field automatically.

### 8. No dismissal/read stats for admins
Admins have no visibility into how many agents have seen or dismissed each announcement.

**Fix**: Add a dismissal count next to each announcement in the admin list (simple count query from `announcement_dismissals`).

### 9. `role` not in queryKey causing stale results
The `useAnnouncements` hook filters by `role` client-side, but `role` isn't in the `queryKey`. If the role loads after the initial fetch, the cached result won't update.

**Fix**: Add `role` to the queryKey: `['announcements', 'active', user?.id, role]`.

### 10. typeConfig duplicated across two files
The same `typeConfig` object is defined in both `AnnouncementModal.tsx` and `AdminAnnouncements.tsx`.

**Fix**: Extract to a shared constants file.

---

## Implementation Plan

### Migration (new SQL)
- Update the announcements SELECT policy to add `TO authenticated`
- Add admin DELETE policy on `announcement_dismissals`

### `src/components/announcements/announcementConstants.ts` (new)
- Extract shared `typeConfig` object

### `src/hooks/useAnnouncements.ts`
- Add `role` to the queryKey
- Add a `dismissAllAnnouncements` mutation that batches inserts instead of looping with individual mutations

### `src/components/announcements/AnnouncementModal.tsx`
- Add `isOpen` local state so X/Escape just hides without dismissing
- Add `if (!current) return null` guard
- Use shared typeConfig import
- "Got it" dismisses only the current one; closing the dialog just hides it temporarily (re-shows on next page load)

### `src/pages/AdminAnnouncements.tsx`
- Add AlertDialog confirmation before delete
- Add dismissal count badge per announcement (query `announcement_dismissals` grouped by `announcement_id`)
- Add image upload button using `assets` storage bucket
- Use shared typeConfig import

| File | Change |
|------|--------|
| New migration | Fix SELECT policy, add admin DELETE on dismissals |
| `src/components/announcements/announcementConstants.ts` | New shared constants |
| `src/hooks/useAnnouncements.ts` | Fix queryKey, add batch dismiss |
| `src/components/announcements/AnnouncementModal.tsx` | Fix crash, fix close behavior, import shared constants |
| `src/pages/AdminAnnouncements.tsx` | Delete confirmation, dismissal stats, image upload, shared constants |

