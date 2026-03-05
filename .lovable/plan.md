

## Dashboard Data Bugs and Fixes

### Critical Bug: Events touchpoints pulling ALL agents' data

**Line 162-163** — The `event_emails` query has **no agent scoping**. It fetches every event email sent this week across the entire platform, not just the current user's events. This is why you see 118 Events touchpoints — those are emails from all agents combined.

**Fix**: Join through the `events` table to scope by `agent_id`:
```
supabase.from('event_emails').select('id, recipient_email, event_id')
  .gte('sent_at', weekStart).lte('sent_at', weekEnd)
```
Then filter client-side by fetching the user's event IDs first, OR use a sub-select. Since `event_emails` doesn't have an `agent_id` column directly, the simplest reliable approach is to first fetch the user's event IDs, then filter `event_emails` with `.in('event_id', userEventIds)`.

---

### Other Bugs Found

**Bug 2: Block Four "Events completed" is hardcoded to 0** (line 271)
- `completedEventCount = 0` with comment "these are filtered to non-completed". The query only fetches incomplete event tasks, so completed ones are never counted. This makes the performance % inaccurate.
- **Fix**: Fetch all event tasks for the week (remove `.is('completed_at', null)` from the week query), then split into completed vs pending.

**Bug 3: Block Four trend only uses SphereSync data** (lines 278-291)
- The 8-week trend chart ignores Events and Coaching entirely, giving an incomplete performance picture.
- **Fix**: Include event tasks and coaching in the weekly trend calculation.

**Bug 4: `closedTransactions` variable is computed but never used** (line 245)
- Dead code — `yearTransactions` counts all transactions regardless of status, but `closedTransactions` is calculated and discarded.

**Bug 5: Social touchpoints query logic is inverted** (line 148-149)
- The social query filters `.neq('status', 'posted')` — this fetches posts that are NOT posted (for the tasks list). But the touchpoints calculation on line 177 then filters for `status === 'posted'`, which will always be 0 since posted ones were excluded from the query.
- **Fix**: Run a separate social query for touchpoints that fetches `.eq('status', 'posted')`, OR combine both and split client-side.

**Bug 6: Unique contacts count mixes IDs with email addresses** (lines 180-182)
- SphereSync adds `lead_id` (a UUID) while event emails add `recipient_email` (an email string). These are different identifier types, so the deduplication doesn't actually work — a contact could be counted twice.
- **Fix**: For event emails, resolve the recipient email to a contact ID, or accept this as an approximation and document it.

---

### Implementation Plan

**File**: `src/hooks/useDashboardBlocks.ts`

1. **Add a preliminary query** to fetch the user's event IDs, then use `.in('event_id', eventIds)` on the `event_emails` touchpoint query.
2. **Split event tasks query** into two: one for all tasks this week (for performance), one for incomplete only (for the task list). Or fetch all and filter client-side.
3. **Add a separate social touchpoints query** with `.eq('status', 'posted')` for Block One.
4. **Include event tasks in the trend** calculation for Block Four.
5. **Remove dead `closedTransactions` variable**.

These are all changes to a single file. No new components or UI changes needed — the display components are correct, they're just receiving wrong data.

