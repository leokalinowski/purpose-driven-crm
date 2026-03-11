

## Audit: SphereSync Weekly Scoreboard — Issues & Improvements

### Bugs Found

**1. `MySubmissionsHistory` is orphaned — never rendered anywhere**
The component exists in `src/components/coaching/MySubmissionsHistory.tsx` but is not imported or used in the rewritten `Coaching.tsx`. Agents have no way to see their past check-ins. The spec (Section E) calls for a "Last 4 Weeks" section on the scoreboard, which exists, but there's no full history view. We should either add a "View All History" toggle/tab on the Coaching page that renders `MySubmissionsHistory`, or remove the dead code.

**2. Admin form missing `contacts_removed` field**
The admin submission form (`AdminCoachingSubmissionForm.tsx`) has fields for Conversations, Activation Attempts, Appointments Set, Contacts Added (leads_contacted), and Activation Day (agreements_signed) — but **no field for Contacts Removed** (`deals_closed`). This means admins cannot enter this metric on behalf of agents, and `deals_closed` defaults to `formData.closings || 0` in the admin submit hook, which is semantically wrong (closings ≠ contacts removed).

**3. `useAdminSubmitCoachingForm` maps `deals_closed` to `formData.closings`**
In `useAdminCoachingData.ts` line 165: `deals_closed: formData.closings || 0`. Since `deals_closed` now means "contacts removed" (per the SphereSync remapping), this conflation means entering closings also overwrites contacts_removed. The admin form needs a separate `contacts_removed` concept, and the mutation needs to map it correctly.

**4. Legacy `useSubmitCoachingForm` hardcodes `deals_closed: 0`**
In `useCoaching.ts` line 241, the legacy admin submit always sets `deals_closed: 0`, which would zero out any agent-submitted "contacts removed" value if an admin later edits via the old path.

**5. `getWeekLabel` calculation is fragile**
In `Coaching.tsx` lines 321-331, the week-start-date calculation for "Last 4 Weeks" uses a manual Monday-finding algorithm that can be off by a week, especially around year boundaries (week 1, week 52/53). Should use `date-fns` `startOfWeek` + ISO week math for consistency.

### Inconsistencies

**6. Admin Deep Dive table shows "Closings" column but not "Activation Day"**
`AgentCoachingDeepDive.tsx` line 234 shows `Closings` in the history table. Since the scoreboard is now SphereSync-focused, the deep dive should show "Activation Day" (Yes/No from `agreements_signed`) and optionally keep closings as a secondary column.

**7. Admin Team Overview table header says "Added" for contacts added**
Technically works, but the label is ambiguous without context. Should say "Contacts Added" or at least have a tooltip.

**8. Sidebar admin label says "Coaching Management" — should be "SphereSync Management"**
The page title already says "SphereSync™ Management" but the sidebar still says "Coaching Management" at line 179.

### Missing from Spec

**9. No "Contacts Removed" column in admin views**
Neither the Team Overview table nor the Deep Dive table displays contacts removed (`deals_closed`). The spec lists it as a core metric.

**10. Dashboard feed mapping not fully updated**
The spec says the scoreboard data should feed the dashboard with specific mappings (Sphere Activations = activation_attempts, etc.). The `useDashboardBlocks.ts` only checks whether a coaching submission exists for the scoreboard task. It doesn't pull conversation counts or other SphereSync metrics into the dashboard blocks.

### Plan

| # | File | Change |
|---|------|--------|
| 1 | `src/pages/Coaching.tsx` | Add a "View History" button/section that renders `MySubmissionsHistory` |
| 2 | `src/pages/Coaching.tsx` | Replace manual `getWeekLabel` with `date-fns` ISO week calculation |
| 3 | `src/components/coaching/AdminCoachingSubmissionForm.tsx` | Add "Contacts Removed" field mapped to `deals_closed` |
| 4 | `src/hooks/useAdminCoachingData.ts` | Fix `deals_closed` mapping — use a separate `contacts_removed` value from formData instead of `closings` |
| 5 | `src/hooks/useCoaching.ts` | Fix legacy `useSubmitCoachingForm` — don't hardcode `deals_closed: 0`, preserve existing value |
| 6 | `src/components/coaching/AgentCoachingDeepDive.tsx` | Add "Activation Day" column, add "Removed" column |
| 7 | `src/components/coaching/AdminTeamOverview.tsx` | Add "Removed" column header |
| 8 | `src/components/layout/AppSidebar.tsx` | Rename "Coaching Management" → "SphereSync Management" |

