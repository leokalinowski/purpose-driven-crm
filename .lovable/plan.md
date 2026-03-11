

## Core Tier Launch Audit: End-to-End Analysis

### Flow Summary

```text
Pricing Page → Stripe Checkout → Webhook provisions user + role → Password-set email → /auth/reset → Dashboard → SphereSync, Database, Coaching, Newsletter, Support, Settings
```

---

### BUGS (Must Fix Before Launch)

**1. Support Hub is NOT gated for Core users**

The memory states "Support Hub access is restricted to Managed and higher." But:
- `ROUTE_MIN_TIER` in `useFeatureAccess.ts` maps `/support` to `'core'` (line 32), meaning Core users CAN access it.
- The `Support.tsx` page has NO `hasAccess` check or `UpgradePrompt` — it renders for everyone.
- The sidebar also shows "Support Hub" to Core users because `hasAccess('/support')` returns `true`.

**Fix:** Change the route tier from `'core'` to `'managed'` in `useFeatureAccess.ts`, and add an `UpgradePrompt` guard in `Support.tsx` (matching the pattern in `Events.tsx` and `Pipeline.tsx`).

**2. UpgradePrompt tells users to "Contact your administrator" — wrong for Core/Managed self-service users**

The `UpgradePrompt` component says: *"Contact your administrator to upgrade your plan."* This makes no sense for self-service subscribers. It should link to `/pricing` with a "View Upgrade Options" button.

**Fix:** Update `UpgradePrompt.tsx` to show a "View Plans" button linking to `/pricing` instead of the admin contact message.

**3. Stripe webhook `handle_new_user` trigger conflict for Pay-First users**

When the webhook creates a user via `admin.createUser`, the `handle_new_user` trigger fires. This trigger checks for a valid invitation (`validate_invited_signup` is bypassed for `supabase_auth_admin`, but `handle_new_user` separately checks for invitations). If no invitation exists (Pay-First flow), it logs "Signup blocked (no invite)" and **skips** profile + role creation. The webhook then creates the profile itself, but the trigger's role assignment is skipped — the webhook handles this separately. However, this means:
- The trigger logs a misleading warning
- If the webhook's profile upsert or role insert fails for any reason, there's no fallback

This is fragile but technically works. **Low priority** but worth noting.

**4. No route protection on gated pages**

`/events`, `/pipeline`, and `/social-scheduler` have in-component `UpgradePrompt` guards, but the **routes themselves** in `App.tsx` are not protected. A Core user can type `/events` in the URL and the page loads (showing UpgradePrompt). This is acceptable UX but:
- `/transactions` has NO access gate at all — no `hasAccess` check, no `UpgradePrompt`. It's not in `ROUTE_MIN_TIER` and not in the sidebar, but directly accessible via URL.

**Fix:** Add `/transactions` to `ROUTE_MIN_TIER` as `'managed'` or add an access check.

---

### UX ISSUES (Should Fix Before Launch)

**5. Pricing page "Core" feature list is too sparse**

Core features listed: SphereSync task engine, Contact database (500 contacts), Weekly coaching submissions, Monthly newsletter. This is only 4 items. Consider adding: "Personal dashboard with weekly metrics", "Historical performance tracking", "Settings & profile management" to make the value clearer.

**6. Success page checkout flow — 15-second timer clears URL params**

After checkout success, the `?checkout=success` param is cleared after 15 seconds. If the user refreshes the page within those 15 seconds, they see the success view again. After 15 seconds, they see the pricing page with no indication of success. This is acceptable but could be jarring.

**7. Password reset link in welcome email points to production domain**

The welcome email hardcodes `https://hub.realestateonpurpose.com/auth/reset`. During testing on preview URLs or staging, this will redirect users to production. Not a bug for launch, but notable for QA.

**8. No loading/empty state feedback on first dashboard load for new Core users**

A brand-new Core user with 0 contacts, 0 tasks, and no scoreboard submission will see a dashboard with all zeros and empty charts. There's no onboarding nudge like "Start by adding contacts to your database" or "Complete your first SphereSync week."

---

### SECURITY CONCERNS

**9. `create-checkout` accepts unauthenticated requests**

By design (Pay-First flow), but this means anyone can create checkout sessions. This is standard for Stripe but worth noting — there's no rate limiting.

**10. `check-subscription` uses `listUsers` scan (performance)**

The webhook's cancellation handler calls `supabase.auth.admin.listUsers()` to find a user by email — this scans ALL users. For a growing user base, this becomes slow. Should use a `profiles` table lookup instead.

---

### WHAT'S WORKING WELL

- Stripe checkout flow (founder, monthly, annual) is solid
- User provisioning via webhook with profile + role creation
- Email sequence (welcome + coaching call) is properly implemented
- Feature gating via `useFeatureAccess` correctly hides sidebar items
- Contact limit enforcement (500 for Core)
- Dashboard blocks correctly filter by `user.id`
- Scoreboard/coaching form works correctly
- Password reset flow is complete
- Settings page with subscription management is functional

---

### Recommended Changes (Priority Order)

| # | Priority | File(s) | Change |
|---|---|---|---|
| 1 | **Critical** | `src/hooks/useFeatureAccess.ts` | Change `/support` from `'core'` to `'managed'` |
| 2 | **Critical** | `src/pages/Support.tsx` | Add `hasAccess('/support')` guard with `UpgradePrompt` |
| 3 | **High** | `src/components/ui/UpgradePrompt.tsx` | Replace "Contact your administrator" with a "View Plans" button linking to `/pricing` |
| 4 | **High** | `src/hooks/useFeatureAccess.ts` | Add `/transactions` to `ROUTE_MIN_TIER` as `'managed'` |
| 5 | **Medium** | `src/config/stripe.ts` | Add more feature descriptions to Core tier list |
| 6 | **Low** | Dashboard | Add first-time-user onboarding nudge for empty states |

