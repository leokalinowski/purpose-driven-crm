

## The Issue: Scoreboard Data Only Visible After Submission

The dashboard feed mapping is implemented but **conditionally hidden** behind `scoreboard.submitted`. This means:

- **Before submitting**: User sees nothing about conversations — no hero metric, no 5-metric grid, no progress toward 25
- **After submitting**: Everything appears

This contradicts the spec's intent — the dashboard should always show the conversation target and encourage progress, even when the submission is at 0/25.

### Fix

Show the scoreboard section **always**, not just when submitted. When no submission exists, display zeros with a prompt to submit.

| # | File | Change |
|---|---|---|
| 1 | `src/components/dashboard/WeeklyTouchpoints.tsx` | Remove the `scoreboard.submitted &&` guards on lines 32 and 45. Always render the Conversations hero and 5-metric grid. When not submitted, the values will naturally show as 0. Add a subtle CTA ("Submit your Weekly Check-In") linking to `/coaching` when `!scoreboard.submitted`. |
| 2 | `src/components/dashboard/WeeklyTasksBySystem.tsx` | No change needed — the scoreboard row already shows "Missing" + "Submit Now" when not submitted, which is correct behavior. |

This is a small UI change — just removing two conditional wrappers and adding a CTA link.

