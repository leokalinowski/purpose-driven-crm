

## Newsletter Analytics Tab — Critical RLS Bug

The analytics dashboard has a **data access problem for non-admin users**. It will appear to work (no errors) but will show **empty data** for regular agents.

### The Problem

The `email_logs` table has RLS policies that **only allow admins** to SELECT:

```
Policy: "Admins can view all email logs"
Command: SELECT
Using: (get_current_user_role() = 'admin'::text)
```

There is no policy allowing agents to view their own email logs. So when a non-admin user loads the Analytics tab, the `useNewsletterAnalytics` hook queries `email_logs` filtered by `agent_id`, but RLS silently returns zero rows. The result: all KPI cards show 0/—, charts say "No data available yet", and the campaign table has no drill-down data.

The `newsletter_campaigns` table likely has the same issue — need to verify its RLS policies allow agent-scoped reads.

### The Fix

**Migration** — Add an RLS policy to `email_logs` so agents can view their own newsletter email logs:

```sql
CREATE POLICY "Agents can view their own email logs"
ON public.email_logs
FOR SELECT
TO authenticated
USING (
  agent_id = auth.uid()
  OR get_current_user_role() = 'admin'::text
);
```

Also need to check and fix `newsletter_campaigns` RLS — agents should be able to read campaigns they created (`created_by = auth.uid()`).

### Secondary Issues

None found in the component logic itself — the hook, chart rendering, CSV export, date filtering, and campaign drill-downs are all correctly implemented. The only issue is the data layer (RLS).

### Files

| File | Change |
|------|--------|
| Migration SQL | Add SELECT policy on `email_logs` for agents to see their own rows |
| Migration SQL | Add SELECT policy on `newsletter_campaigns` for agents to see their own campaigns |

