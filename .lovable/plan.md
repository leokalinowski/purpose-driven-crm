

# Redesign: Agent Settings Tab → Agent Newsletter Overview

## Problem

The current "Agent Settings" tab has two issues:

1. **Wrong contact counts**: The query in `useAdminNewsletter` (lines 89-101) fetches contacts via `supabase.from('contacts').select('agent_id').not('email', 'is', null)`. As an admin, RLS returns ALL contacts across all agents, and the client-side counting should work. However, the query downloads every single contact row just to count them -- if any contacts have null `agent_id` or if the grouping logic has edge cases, counts could drift. The fix is to use a server-side `count` query per agent, or a single grouped RPC.

2. **The "Enabled/Disabled" toggle is vestigial**: Since you no longer run automated recurring newsletter sends -- you personalize and send each month manually -- the toggle controls nothing. The `newsletter_settings` table's `enabled`, `schedule_day`, and `schedule_hour` columns are unused dead weight.

## Proposed Redesign

Replace the "Agent Settings" tab with an **"Agent Overview"** tab that shows at-a-glance newsletter readiness and history per agent. No toggles, no settings -- just useful operational data and quick actions.

### What each agent card would show:

| Data Point | Source | Purpose |
|---|---|---|
| Agent name + email | `profiles` | Identity |
| Contacts with email (accurate count) | `contacts` with server-side `count` | Know audience size |
| Templates count | `newsletter_templates` | Know if they have content ready |
| Last campaign sent | `newsletter_campaigns` (most recent by `created_by`) | Know recency |
| Last campaign recipients + open rate | Same campaign row | Quick performance check |
| Quick actions: "Create Template" + "View Templates" | Navigation buttons | Speed up workflow |

### What gets removed:

- The `Enabled/Disabled` Switch and Badge
- The `newsletter_settings` query (no longer needed on this page)
- The `updateSettings` mutation

### Implementation Details

**File: `src/hooks/useAdminNewsletter.ts`**
- Replace the bulk contact fetch (lines 89-101) with per-agent server-side `count` queries using `{ count: 'exact', head: true }`
- Add a query for the most recent campaign per agent from `newsletter_campaigns`
- Remove the `newsletter_settings` query and `updateSettingsMutation`
- Keep settings in the return type as optional (in case other code references it) or remove entirely after checking for usages

**File: `src/pages/AdminNewsletter.tsx`**
- Rename tab from "Agent Settings" to "Agent Overview"
- Replace the toggle-based card layout with the new overview cards showing: contact count, template count, last campaign info, and quick action buttons
- Remove Switch/Badge imports related to enabled state
- Add navigation buttons: "Create Template" (navigates to `/newsletter-builder?agent={id}`) and "View Templates" (filters the Templates tab to that agent)

### Contact Count Fix

The current approach downloads every contact row with email, then counts client-side. The fix:

```
// Per-agent count using head:true (no rows downloaded)
const { count } = await supabase
  .from('contacts')
  .select('id', { count: 'exact', head: true })
  .eq('agent_id', agentId)
  .not('email', 'is', null)
  .neq('email', '');
```

This will be done in a `Promise.all` over all agent IDs, returning accurate counts without downloading any row data.

### Files to Modify

| File | Changes |
|---|---|
| `src/hooks/useAdminNewsletter.ts` | Fix contact count query; add last-campaign-per-agent query; remove newsletter_settings query and mutation |
| `src/pages/AdminNewsletter.tsx` | Redesign Agent Settings tab → Agent Overview with readiness cards and quick actions; remove Switch/toggle UI |

