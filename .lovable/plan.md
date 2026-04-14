

## Plan: Fix 4 Security Issues

### Fix 1 — `src/main.tsx`: Gate console logging behind DEV check

Wrap lines 7-11 (the four `console.log` statements logging initialization info, Supabase URL, environment, and base URL) inside `if (import.meta.env.DEV) { ... }`. Also gate the success log on line 67 (`console.log('✅ React app mounted successfully')`).

**File changed:** `src/main.tsx`

---

### Fix 2 — XSS: Sanitize all `dangerouslySetInnerHTML` usage

Install `dompurify` and `@types/dompurify`, then add `import DOMPurify from 'dompurify'` and wrap every `__html` value with `DOMPurify.sanitize(...)` in these files:

| File | Lines |
|------|-------|
| `src/components/newsletter/builder/BlockRenderer.tsx` | Lines 216, 416 |
| `src/components/admin/AdminNewsletterPreview.tsx` | Line 297 |
| `src/components/newsletter/NewsletterPreview.tsx` | Line 334 |

**Files changed:** 3 component files + `package.json`

---

### Fix 3 — Admin pages: Add loading guard before content renders

Several admin pages either lack `useUserRole` entirely or have no early return while auth/role state is loading. Add `useUserRole` + loading guard + admin redirect to each:

| Page | Current state | Fix needed |
|------|--------------|------------|
| `AdminCoachingManagement.tsx` | No admin check at all | Add `useUserRole`, loading guard, redirect |
| `AdminNewsletter.tsx` | No admin check at all | Add `useUserRole`, loading guard, redirect |
| `AdminSurveyResults.tsx` | No admin check at all | Add `useUserRole`, loading guard, redirect |
| `AdminAnnouncements.tsx` | No admin check at all | Add `useUserRole`, loading guard, redirect |
| `AdminSocialScheduler.tsx` | No admin check at all | Add `useUserRole`, loading guard, redirect |
| `AdminDatabaseManagement.tsx` | Has `useUserRole` but no loading guard | Add `loading` destructure + early return |
| `AdminTeamManagement.tsx` | Has auth check but no `useUserRole` guard | Add `useUserRole`, loading guard |

Pattern for each:
```tsx
const { isAdmin, loading: roleLoading } = useUserRole();

if (roleLoading) return null;
if (!isAdmin) return <Navigate to="/" replace />;
```

**Files changed:** 7 admin page files

---

### Fix 4 — `src/pages/OAuthCallback.tsx`: Validate platform + fix redirect logic

Two changes:

1. After extracting `platform`, validate it against a whitelist:
```tsx
const ALLOWED_PLATFORMS = ['google', 'facebook', 'instagram', 'linkedin', 'twitter', 'tiktok'];
if (!ALLOWED_PLATFORMS.includes(platform)) {
  throw new Error(`Unsupported platform: ${platform}`);
}
```

2. Remove the error-case `setTimeout` redirect (lines 87-90) so users on error stay on the callback page with the error message instead of being auto-redirected. Only redirect on success.

**File changed:** `src/pages/OAuthCallback.tsx`

---

### Summary of all files

| # | Fix | Files |
|---|-----|-------|
| 1 | Gate dev logging | `src/main.tsx` |
| 2 | DOMPurify sanitization | `BlockRenderer.tsx`, `AdminNewsletterPreview.tsx`, `NewsletterPreview.tsx`, `package.json` |
| 3 | Admin loading guards | 7 admin page files |
| 4 | OAuth platform validation | `OAuthCallback.tsx` |

**Total: 12 files changed, 1 package installed**

