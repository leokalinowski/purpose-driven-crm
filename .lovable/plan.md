

## Plan: Update Pre-Event Task List

Replace the current 32 pre-event tasks with 31 updated tasks in `src/utils/defaultEventTasks.ts`.

### Summary of Changes

**Removed** (4 tasks):
- "Test hub RSVP" (-45)
- "Export Database from Hub" (-45)
- "Confirm Event Type" (-3)
- "Gate check: Venue + Owner confirmed" (-2)

**Renamed** (2 tasks):
- "Request Speaker & Sponsor Commitments" → "Request Sponsor Commitments"
- "Update Promo Kit for Sponsors" → "Provide Materials to Sponsors"
- "Confirm charity" → "Confirm charity (if applicable)"

**Timing Changes** (3 tasks):
- "Draft Event Budget": -50 → -60
- "Agent Call/Text Round #1": -10 → -30
- "Confirm Venue": -3 → -35

**Added** (3 tasks):
- "Order Event Signage & Printed Materials" at -21 (Event Coordinator)
- "Send Day-Of Agenda to Team" at -2 (Event Coordinator)
- "Final Walkthrough with Venue" at -1 (Event Coordinator)

### File to Modify

`src/utils/defaultEventTasks.ts` — Replace lines 12-44 (the pre-event section) with the updated task list, sorted by `days_offset` descending.

### Final Pre-Event Task Order

| # | Task | Days | Owner |
|---|------|------|-------|
| 1 | Confirm Event Theme & Date | -60 | EC |
| 2 | Draft Event Budget | -60 | EC |
| 3 | Request Sponsor Commitments | -55 | EC |
| 4 | Confirm charity (if applicable) | -50 | EC |
| 5 | Create Facebook & LinkedIn Events | -42 | Mktg |
| 6 | Provide Materials to Sponsors | -40 | Mktg |
| 7 | Send Save-the-Date Email | -38 | Mktg |
| 8 | Post Save-the-Date on Social | -38 | Mktg |
| 9 | Confirm Venue | -35 | EC |
| 10 | Personalize postcard to mail | -35 | EC |
| 11 | Finalize Vendor Selections | -30 | EC |
| 12 | Agent Call/Text Round #1 | -30 | EC |
| 13 | Email #1 Formal Invite | -28 | Mktg |
| 14 | SMS Nudge #1 | -25 | Mktg |
| 15 | Order Event Signage & Printed Materials | -21 | EC |
| 16 | Email #2 15-Day Reminder | -15 | Mktg |
| 17 | Mail invite to Sphere | -15 | EC |
| 18 | Social Content Schedule | -14 | Mktg |
| 19 | Check RSVP Progress | -12 | EC |
| 20 | Check RSVP Progress #2 | -8 | EC |
| 21 | Email #3 One-Week Reminder | -7 | Mktg |
| 22 | SMS Nudge #2 | -6 | Mktg |
| 23 | Check RSVP Progress #3 | -5 | EC |
| 24 | Confirm Catering Headcount | -5 | EC |
| 25 | Charity Delivery Prep | -4 | EC |
| 26 | Confirm sponsors | -4 | EC |
| 27 | Day-Of Kit - remind agent | -3 | EC |
| 28 | Send Check-in list to print | -2 | EC |
| 29 | Send Day-Of Agenda to Team | -2 | EC |
| 30 | Remind Sponsors | -1 | EC |
| 31 | Final Walkthrough with Venue | -1 | EC |

Event Day and Post-Event sections remain unchanged.

