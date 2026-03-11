

## Scoreboard vs Spec: Gap Analysis

### What's Already Working

The agent-facing Weekly Check-In form and Weekly Scoreboard are fully implemented and match the spec:

- Sections 1-5 (form fields, hero metric, relationship work, discipline/streak, momentum rates, last 4 weeks) -- all present and correct
- Section 7 (calculation rules) -- implemented correctly
- Section 8 (UX: conversations first, target 25, mobile-friendly, edit support) -- done
- Section 9 (reminder email) -- updated to SphereSync vocabulary
- Section 10 (definitions in helper text) -- present in form

### What's Missing

**1. Dashboard Feed Mapping (Section 6) -- NOT implemented**

The spec explicitly defines how scoreboard data should appear on the Dashboard:

| Dashboard Metric | Source Field | Current Status |
|---|---|---|
| Sphere Activations | `activation_attempts` | Not shown on dashboard |
| Unique Relationships Activated | `conversations` | Not shown on dashboard |
| Opportunity Creation | `appointments_set` | Not shown on dashboard |
| Database Growth | `contacts_added` | Not shown on dashboard |
| Database Hygiene | `contacts_removed` | Not shown on dashboard |

Right now, the dashboard (Block 2) only checks whether a scoreboard submission *exists* for the current week. It does not display the actual numbers from the check-in. This is the single biggest gap.

**2. Minor: table name difference (cosmetic, not blocking)**

The spec says create a `weekly_activity` table. The current implementation uses `coaching_submissions` with field remapping (e.g., `dials_made` = activation_attempts, `leads_contacted` = contacts_added). This works functionally but adds cognitive overhead. Creating a new clean table would be ideal but is a large migration. Not recommended for now since everything works.

### Plan

| # | File | Change |
|---|---|---|
| 1 | `src/hooks/useDashboardBlocks.ts` | In Block 1 (Weekly Impact), pull `conversations` from `coaching_submissions` for the current week and display as "Unique Relationships Activated". Pull `dials_made` (activation_attempts) and add to total touchpoints or show separately as "Sphere Activations". |
| 2 | `src/hooks/useDashboardBlocks.ts` | In Block 2 (Weekly Tasks), enhance the scoreboard task to show the conversation count inline (e.g., "18/25 conversations") instead of just "submitted" / "not submitted". |
| 3 | `src/hooks/useDashboardBlocks.ts` | Add scoreboard metrics to Block 3 or a new summary section: Database Growth (contacts_added / `leads_contacted`), Database Hygiene (contacts_removed / `deals_closed`), Opportunity Creation (appointments_set). |
| 4 | `src/components/dashboard/DashboardCards.tsx` or equivalent | Update the dashboard UI components to render the new mapped metrics from the scoreboard data. |

This connects the scoreboard to the dashboard as the spec requires, completing the data flow: Check-In → Scoreboard → Dashboard.

