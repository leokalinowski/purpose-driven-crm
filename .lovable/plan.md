

## Dashboard Data Reliability Audit

### Architecture Summary

The system has two dashboards:
- **`/` (Index)** — uses `useDashboardBlocks`, always queries by `user.id`. Every role sees this.
- **`/admin/dashboard`** — admin-only, uses separate hooks for company-wide data.

The personal dashboard at `/` is role-agnostic by design. It shows whatever data exists for the logged-in user.

### Reliability Assessment

**What's working correctly:**

| Data Source | Query Filter | RLS Compatible | Status |
|---|---|---|---|
| `spheresync_tasks` | `agent_id = user.id` | Yes | Reliable |
| `event_tasks` | `agent_id = user.id` | Yes | Reliable |
| `contacts` | `agent_id = user.id` | Yes | Reliable |
| `coaching_submissions` | `agent_id = user.id` | Yes | Reliable |
| `newsletter_campaigns` | `created_by = user.id` | Yes | Reliable |
| `social_posts` | `agent_id = user.id` | Yes | Reliable |
| `event_emails` | Scoped via user's event IDs | Yes | Reliable |
| `newsletter_task_settings` | `agent_id = user.id` | Yes | Reliable |

Every query explicitly filters by the user's ID, and every table's RLS policies allow users to read their own data. This is solid.

### Potential Issues by Role

**Core & Managed users**: They see dashboard blocks for Events and Social, but these features are gated behind `useFeatureAccess`. If they navigate to `/events` or `/social-scheduler`, they're blocked. However, the dashboard still shows empty task lists for those systems — it doesn't hide them. This creates mild confusion (showing "Events: 0 tasks" when they can't use Events at all).

**Admins visiting `/`**: They see their own personal agent-level data, which is correct. Their company-wide view is at `/admin/dashboard`.

**Editors**: Same as agents — personal data only. Works fine.

### One Real Bug Found

In the `event_emails` query (lines 183-187), if an admin visits `/`, the query fetches events where `agent_id = user.id`. But admins might create events with `created_by` set to their ID rather than `agent_id`. The events table has both `agent_id` and `created_by` fields. If an admin creates an event and assigns it to an agent (`agent_id = agent's UUID`), the admin's personal dashboard won't show those event email touchpoints. This is minor and arguably correct behavior (the event belongs to the agent).

### Verdict

**The data pull is reliable for all account types.** No silent failures, no RLS conflicts, no missing filters. The one improvement worth considering:

| # | Change | Impact |
|---|---|---|
| 1 | Hide Events and Social blocks for `core` and `managed` users in `WeeklyTasksBySystem.tsx` and `WeeklyTouchpoints.tsx` | Removes confusion — don't show systems they can't access |

This is a small UX polish, not a data reliability fix. No data is being pulled incorrectly.

