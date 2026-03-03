

## Database Improvement Opportunities

After reviewing the current state, the 9 priority bugs from the previous plan have been fixed. Here are the remaining and new improvements worth pursuing:

### High-Value Improvements

**1. Add search by tags, city, state, and address**
Currently `useContacts` only searches `first_name`, `last_name`, `email`, and `phone`. Agents with many contacts can't find people by location or tag, which is a significant limitation for a real estate CRM.

- File: `src/hooks/useContacts.ts` (lines 71-78 and 116-123)
- Add `city.ilike`, `state.ilike`, `address_1.ilike`, and a tag array search to both `fetchAllContacts` and `fetchContacts`
- Update the search placeholder text in `Database.tsx` (line 529) to reflect the expanded search

**2. Replace custom Duplicate Cleanup modal with a proper Dialog**
The duplicate cleanup uses a raw `div.fixed.inset-0` overlay (Database.tsx lines 628-644) instead of the project's existing `Dialog` component. This means no focus trapping, no `Escape` key to close, no accessibility, and inconsistent styling.

- File: `src/pages/Database.tsx` (lines 627-644)
- Wrap `DuplicateCleanup` in a `<Dialog>` with `DialogContent` instead of a manual overlay

**3. Duplicate `ContactInput` type definitions**
Three separate definitions exist:
- `src/hooks/useContacts.ts` (Omit-based, `dnc: boolean` required)
- `src/utils/contactUtils.ts` (manual interface, `dnc?: boolean` optional)
- `src/types/api.ts` (manual interface, different optionals)

Consolidate to a single source of truth exported from one file, and re-export from the others.

**4. `useContactActivities` bypasses TypeScript with `(supabase as any)`**
All four Supabase queries in `src/hooks/useContactActivities.ts` use `as any` casts, hiding type errors. The `contact_activities` table likely needs to be added to the generated types, or the queries should use `.from('contact_activities' as any)` with proper return typing at minimum.

**5. Duplicate cleanup doesn't refresh parent contacts list**
After `DuplicateCleanup` executes cleanup, it only shows a toast. The parent `Database.tsx` never calls `fetchContacts()` after duplicates are removed, so the table still shows deleted contacts until the user manually refreshes.

- File: `src/pages/Database.tsx` — pass `fetchContacts` as an `onComplete` callback to `DuplicateCleanup`
- File: `src/components/database/DuplicateCleanup.tsx` — call `onComplete()` after cleanup succeeds

**6. ZIP code enrichment is hardcoded to 5 cities**
`enrichFromZipCode()` in `dataEnrichment.ts` (line 192) has a static lookup of only 5 ZIP codes. For a real estate CRM, this is essentially useless. Either remove the feature or connect it to a real ZIP code API/dataset.

### Medium-Value Improvements

**7. No export/download contacts feature**
Agents can upload CSVs but can't export their contact list. A "Download CSV" button would be useful for backups and data portability.

**8. Contact form name validation too restrictive**
The regex `^[a-zA-Z\s'-]+$` (ContactForm.tsx line 26) rejects names with periods (e.g., "Dr. Smith"), accented characters (e.g., "José"), and other valid name characters. This is a real estate CRM serving diverse clients.

### Proposed Implementation (if approved)

| # | Improvement | Files | Impact |
|---|---|---|---|
| 1 | Expand search to tags/city/state/address | `useContacts.ts`, `Database.tsx` | High - core usability |
| 2 | Proper Dialog for duplicate cleanup | `Database.tsx` | Medium - accessibility |
| 3 | Consolidate ContactInput types | `useContacts.ts`, `contactUtils.ts`, `api.ts` | Medium - maintainability |
| 4 | Duplicate cleanup refreshes parent list | `Database.tsx`, `DuplicateCleanup.tsx` | Medium - UX |
| 5 | Relax name validation regex | `ContactForm.tsx` | Medium - data integrity |
| 6 | Add CSV export button | `Database.tsx` | Medium - feature gap |

