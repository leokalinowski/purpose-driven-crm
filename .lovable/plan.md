

## Plan: Repurpose Coaching System into SphereSync Weekly Scoreboard

### Approach

Repurpose the existing `coaching_submissions` table by remapping its columns to the new SphereSync vocabulary. No new table needed — the existing columns map cleanly:

| New Field | Existing Column | Notes |
|-----------|----------------|-------|
| conversations (HERO) | `conversations` | Currently hardcoded to 0 — will now be primary input |
| activation_attempts | `dials_made` | Same concept, new label |
| appointments_set | `appointments_set` | Unchanged |
| contacts_added | `leads_contacted` | Repurposed — was "leads contacted" |
| contacts_removed | `deals_closed` | Repurposed — was unused (hardcoded to 0) |
| activation_day_completed | `agreements_signed` | Repurposed as boolean (0 = no, 1 = yes) |

Columns like `closings`, `closing_amount`, `appointments_held`, `offers_made_accepted` stay in the table but won't appear in the agent check-in form. The admin form will keep them accessible so admins can still track closings/transactions.

### Changes

**1. Rewrite `src/pages/Coaching.tsx`** — Two-view layout:
- **Weekly Check-In view**: Conversations as hero field with large input + progress bar toward 25. Then activation_attempts, appointments_set, contacts_added, contacts_removed, activation_day toggle. Mobile-first, 30-second form. Auto-detects current week. Pre-populates if entry exists.
- **Weekly Scoreboard view** (shown after submit or via toggle): Hero conversation count with progress ring. Relationship Work summary. Discipline section (streak calculation + activation day). Momentum rates (activation→conversation %, conversation→consultation %). Last 4 weeks trend.

**2. Update `src/hooks/useCoaching.ts`**:
- Update `CoachingFormData` interface to use new field names mapped to existing columns
- Update `useSubmitCoachingForm` to write `conversations`, `dials_made`, `leads_contacted` (contacts_added), `deals_closed` (contacts_removed), `agreements_signed` (activation_day as 0/1)
- Add `useWeeklyStreak()` hook — counts consecutive weeks with submissions in reverse chronological order
- Add `useLast4Weeks()` hook — fetches last 4 entries for trend display

**3. Update `src/components/coaching/MySubmissionsHistory.tsx`** — Relabel all fields to SphereSync vocabulary (conversations, activation attempts, contacts added/removed)

**4. Update Admin Coaching Management** — All 4 files:
- `src/pages/AdminCoachingManagement.tsx` — Update summary cards to show conversations as primary metric, rename "Avg Attempts" to "Avg Conversations"
- `src/components/coaching/AdminTeamOverview.tsx` — Relabel table columns, add Conversations column, update leaderboard to rank by conversations
- `src/components/coaching/CoachingInsights.tsx` — Update insights to track conversations toward 25 target, relabel all metrics
- `src/components/coaching/AgentCoachingDeepDive.tsx` — Relabel summary cards and trend charts to SphereSync vocabulary
- `src/components/coaching/AdminCoachingSubmissionForm.tsx` — Keep closings/transaction fields for admin use, but add the new SphereSync fields (conversations, contacts_added, contacts_removed, activation_day)
- `src/hooks/useAdminCoachingData.ts` — Update field references in team overview queries

**5. No database migration needed** — All columns already exist. We're just changing which columns the UI reads/writes and how they're labeled.

### What stays unchanged
- The `coaching_submissions` table structure
- RLS policies
- Admin's ability to track closings and $ closed (kept in admin forms/views)
- Coaching reminder email logic
- Dashboard blocks that reference coaching submissions

