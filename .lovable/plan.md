

## Add Event-Day and Post-Event Task Templates

**File: `src/utils/defaultEventTasks.ts`**

Add the following tasks to the `DEFAULT_EVENT_TASKS` array, after the existing pre-event tasks:

### Event Day (days_offset: 0)
| Task | Responsible |
|---|---|
| Setup Venue | Event Coordinator |
| Capture Photos/Videos | Marketing |
| Collect Doorprize & Leads | Event Coordinator |

### Post-Event (days_offset: +1 to +14)
| Task | Offset | Responsible |
|---|---|---|
| Send Thank-You Email | +1 | Marketing |
| Charity Delivery | +2 | Event Coordinator |
| Agent Follow-Up Calls | +3 | Event Coordinator |
| Post Event Social Highlights | +3 | Marketing |
| Sponsor Thank-Yous | +5 | Event Coordinator |
| KPI Report & Scoreboard Entry | +7 | Event Coordinator |
| Archive Assets | +14 | Marketing |

No other files need changes. The existing `buildTaskInserts()` function already handles positive offsets correctly (days after event). New events created after this change will automatically include all three phases.

Note: Existing events (like the "Test" event) will not retroactively gain these tasks. If needed, I can add a one-time backfill query.

