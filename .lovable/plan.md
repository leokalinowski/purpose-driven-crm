

## DNC Access Control, Contact Limits, and Reliability Hardening

### Summary

Restrict the manual "Run DNC Check" / "Force Recheck" buttons to admins only, enforce contact limits per tier (Core: 500, Managed: 1000), and ensure DNC checks fire reliably on every contact entry point.

---

### 1. Remove DNC buttons for non-admin users

**Files:** `src/pages/Database.tsx`, `src/hooks/useDNCStats.ts`

The DNC check buttons and stats dashboard are already wrapped in `{isAdmin && (...)}` (line 500), so non-admins already cannot see them. However, `useDNCStats` still exposes `triggerDNCCheck` to all users. We will:
- Keep the admin-only UI gating as-is (already correct)
- Remove the `triggerDNCCheck` export for non-admins by having it throw if `!isAdmin` (defense in depth)
- The DNC stats card (read-only) will remain visible to all users so they can see their compliance status

### 2. Ensure DNC fires on all three entry points

**Entry point A: Single contact creation** (`ContactForm.tsx`)
- Currently DNC only fires on edit (`contact?.id` check at line 191). For new contacts, the parent `handleAddContact` in `Database.tsx` doesn't trigger DNC either.
- Fix: After `addContact()` returns the new contact with its ID, call `dnc-single-check` with the new contact's ID and phone. Add this to `handleAddContact` in `Database.tsx`.

**Entry point B: CSV bulk upload** (`Database.tsx` line 322-361)
- Currently calls `triggerDNCCheck(false)` after upload, which invokes `dnc-monthly-check`. This is correct and already works for the logged-in user's contacts.
- No change needed, but we'll add the contact limit check BEFORE the upload starts (see item 3).

**Entry point C: Monthly cron** (`dnc-monthly-check`)
- Already processes all agents via cron. The edge function queries `user_roles` for all agents/admins and checks all non-DNC contacts older than 30 days.
- No change needed to the cron logic itself.

### 3. Contact limits per tier

**Files:** `src/hooks/useContacts.ts`, `src/pages/Database.tsx`, `src/hooks/useFeatureAccess.ts`

Add a contact limit system:

- Define limits in `useFeatureAccess.ts`:
  ```
  core: 500, managed: 1000, agent/editor/admin: unlimited (null)
  ```
- In `useContacts.addContact()`: Before inserting, check current count vs limit. Reject with a clear error if at capacity.
- In `useContacts.uploadCSV()`: Before inserting, check `currentCount + csvData.length` vs limit. Reject with a clear error showing how many slots remain.
- In `Database.tsx`: Show the current count vs limit near the "Add Contact" button so users know their capacity. Disable the "Add Contact" and "Upload CSV" buttons when at limit.

### 4. Admin-specific: Recheck specific contacts / specific databases

**Files:** `src/pages/Database.tsx`, `src/components/database/ContactTable.tsx`, `src/hooks/useDNCStats.ts`

For admins:
- Add a "Recheck DNC" action to the per-contact action menu (only visible to admins). This calls `dnc-single-check` for that specific contact.
- The existing "Run DNC Check" button already supports `agentId` scoping. We'll add an admin agent selector dropdown (the existing `AgentSelector` component) so admins can pick a specific agent's database to recheck.

### 5. Reliability improvements to `dnc-single-check`

**File:** `supabase/functions/dnc-single-check/index.ts`

Current issues:
- No authentication check at all -- anyone with the anon key can call it
- Uses anon key + auth header passthrough for the DB update, but doesn't verify the caller owns the contact

Fix:
- Add JWT verification: extract user from auth header, verify they own the contact (or are admin) before proceeding
- Add retry logic: if the DNC API returns a non-OK HTTP status, retry once before failing
- Add timeout: wrap the fetch in `AbortSignal.timeout(10000)` to prevent hanging

### 6. Reliability improvements to `dnc-monthly-check`

**File:** `supabase/functions/dnc-monthly-check/index.ts`

- Already fixed in previous iteration: `dnc_last_checked` not updated on failure, uses `user_roles`, agents can check own contacts
- Additional: Add a summary notification -- after the monthly cron completes, insert a record into a lightweight `dnc_run_summary` or reuse `dnc_logs` with aggregate stats so admins can audit

---

### Technical Details

**Contact limit constants:**
```
CONTACT_LIMITS = { core: 500, managed: 1000, agent: null, editor: null, admin: null }
```

**New helper in `useFeatureAccess.ts`:**
```typescript
const getContactLimit = (): number | null => {
  return CONTACT_LIMITS[role as Tier] ?? 500; // Default to most restrictive
};
```

**Files to modify:**
| File | Change |
|------|--------|
| `src/hooks/useFeatureAccess.ts` | Add `getContactLimit()` |
| `src/hooks/useContacts.ts` | Add limit check in `addContact` and `uploadCSV` |
| `src/pages/Database.tsx` | Show capacity indicator, disable buttons at limit, add admin agent selector for DNC, add per-contact recheck for admins, fire DNC on new contact add |
| `src/components/database/ContactTable.tsx` | Add "Recheck DNC" to admin action menu |
| `src/hooks/useDNCStats.ts` | Add `isAdmin` guard to `triggerDNCCheck` |
| `supabase/functions/dnc-single-check/index.ts` | Add auth verification, retry, timeout |

