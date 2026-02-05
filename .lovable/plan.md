

## Enhanced Support Ticket Task Description

### Summary

Update the `create-support-ticket` edge function to include comprehensive agent context in the ClickUp task description. This approach avoids creating multiple custom fields by embedding all profile information and platform metrics directly in a well-formatted markdown description.

---

### What Will Be Included in Each Ticket

#### Agent Profile Information
| Field | Source |
|-------|--------|
| Full Name | `profiles.full_name` |
| Email | `profiles.email` |
| Phone | `profiles.phone_number` |
| Office Phone | `profiles.office_number` |
| Brokerage | `profiles.brokerage` |
| Team Name | `profiles.team_name` |
| License Number | `profiles.license_number` |
| Licensed States | `profiles.license_states` or `profiles.state_licenses` |
| Office Address | `profiles.office_address` |
| Website | `profiles.website` |
| Member Since | `profiles.created_at` |

#### Platform Engagement Metrics (calculated at ticket time)
| Metric | Source | Description |
|--------|--------|-------------|
| Database Size | `contacts` count | Total contacts in their database |
| Tasks This Week | `spheresync_tasks` count | SphereSync tasks assigned this week |
| Tasks Completed | `spheresync_tasks` (completed=true) | Tasks completed this week |
| Completion Rate | Calculated | Tasks completed / tasks assigned |
| Scoreboard Status | `coaching_submissions` | Yes/No/Overdue based on current week |
| Last Coaching Date | `coaching_submissions.week_ending` | Most recent submission date |
| Open Tickets | `support_tickets` count | Other active tickets |
| Action Items Pending | `agent_action_items` count | Unresolved action items |

---

### Example Task Description Output

```text
## Agent Profile

**Name:** Timothy Raiford
**Email:** tim@example.com
**Phone:** (555) 123-4567
**Office:** (555) 987-6543
**Brokerage:** XYZ Realty
**Team:** The Raiford Group
**License:** #12345 (GA, FL)
**Office Address:** 123 Main St, Atlanta, GA 30301
**Website:** https://timraiford.com
**Member Since:** January 15, 2024

---

## Platform Engagement

| Metric | Value |
|--------|-------|
| Database Size | 1,247 contacts |
| Tasks This Week | 8 assigned |
| Tasks Completed | 5 (62.5%) |
| Scoreboard | Submitted (Week 5, 2025) |
| Open Tickets | 1 other |
| Action Items | 2 pending |

---

## Ticket Information

**Category:** Database
**Priority:** High

---

## Issue Description

[User's description goes here]

---

*Submitted via Hub Agent Support Portal*
```

---

### Technical Implementation

#### File to Update
`supabase/functions/create-support-ticket/index.ts`

#### Changes Required

1. **Expand Profile Query** - Fetch all relevant profile fields:
   - `full_name`, `email`, `phone_number`, `office_number`
   - `brokerage`, `team_name`, `license_number`, `license_states`, `state_licenses`
   - `office_address`, `website`, `created_at`

2. **Add Metric Queries** - Query counts from related tables:
   - `contacts` - Total database size
   - `spheresync_tasks` - Tasks this week and completion status
   - `coaching_submissions` - Latest submission and scoreboard status
   - `support_tickets` - Count of other open tickets
   - `agent_action_items` - Pending unresolved items

3. **Week Calculation Helper** - Add function to get current ISO week number and determine if coaching scoreboard is submitted/overdue

4. **Enhanced Description Builder** - Replace the `buildDescription` function with a comprehensive version that formats all data into readable markdown

---

### Query Examples

```typescript
// Expanded profile query
const { data: profile } = await supabase
  .from('profiles')
  .select(`
    first_name, last_name, email, phone_number, full_name,
    brokerage, team_name, license_number, license_states, state_licenses,
    office_number, office_address, website, created_at
  `)
  .eq('user_id', user.id)
  .single();

// Database size
const { count: databaseSize } = await supabase
  .from('contacts')
  .select('*', { count: 'exact', head: true })
  .eq('agent_id', user.id);

// SphereSync tasks this week
const { count: tasksThisWeek } = await supabase
  .from('spheresync_tasks')
  .select('*', { count: 'exact', head: true })
  .eq('agent_id', user.id)
  .eq('week_number', currentWeek)
  .eq('year', currentYear);

const { count: tasksCompleted } = await supabase
  .from('spheresync_tasks')
  .select('*', { count: 'exact', head: true })
  .eq('agent_id', user.id)
  .eq('week_number', currentWeek)
  .eq('year', currentYear)
  .eq('completed', true);

// Latest coaching submission
const { data: latestCoaching } = await supabase
  .from('coaching_submissions')
  .select('week_ending, week_number, year')
  .eq('agent_id', user.id)
  .order('week_ending', { ascending: false })
  .limit(1)
  .single();

// Open tickets count (excluding current)
const { count: openTickets } = await supabase
  .from('support_tickets')
  .select('*', { count: 'exact', head: true })
  .eq('agent_id', user.id)
  .in('status', ['open', 'in_progress']);

// Pending action items
const { count: pendingActionItems } = await supabase
  .from('agent_action_items')
  .select('*', { count: 'exact', head: true })
  .eq('agent_id', user.id)
  .is('resolved_at', null)
  .eq('is_dismissed', false);
```

---

### Benefits

- **No ClickUp Configuration Needed** - All data lives in the task description
- **Immediate Context** - Support team sees everything at a glance without clicking through fields
- **Easy to Maintain** - Adding new metrics just requires updating the description builder
- **Fallback Friendly** - If any query fails, the description still renders with available data

