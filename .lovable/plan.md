

# Newsletter Analytics -- Full Audit and Improvement Plan

## Issues Found

### Critical: campaign_id column never populated

The migration added a `campaign_id` column to `email_logs`, and the webhook correctly reads it to recalculate campaign stats. However, **none of the three sending functions actually write to this column**:

- **newsletter-send**: stores `campaign_id` inside `metadata` JSONB, not the actual `campaign_id` column
- **newsletter-template-send**: doesn't reference `campaign_id` at all -- no campaign record is even created for template sends
- **newsletter-monthly**: doesn't log individual emails to `email_logs` with campaign_id

This means the webhook's campaign recalculation logic will never fire. Open/click rates on campaigns will stay at 0 forever despite real Resend events coming in.

### Bug: Stacked bar chart double-counts

The "Email Volume by Month" bar chart stacks `delivered`, `opened`, and `bounced`. But in the hook, emails with status `opened` or `clicked` are counted in **both** `delivered` and `opened` buckets. So the stacked total overstates the actual volume.

### Unused code: expandedCampaign state

The `expandedCampaign` state variable is declared and the `Collapsible` component is imported, but the expandable per-campaign drill-down was never built.

### Missing: Agent names on campaigns

The plan called for agent name resolution via `created_by`, but the query just selects raw `created_by` UUIDs with no join.

### Missing: newsletter-template-send doesn't create campaign records

When sending from the template builder, no `newsletter_campaigns` row is created, so those sends are invisible in the campaign table.

---

## Plan

### 1. Fix campaign_id population in all sending functions

| Function | Change |
|----------|--------|
| `newsletter-send/index.ts` | Add `campaign_id: campaignRecord?.id` as a top-level column in both email_logs insert calls (success + failure), alongside the existing metadata |
| `newsletter-template-send/index.ts` | Create a `newsletter_campaigns` record before sending, then pass its id as `campaign_id` in all email_logs inserts |
| `newsletter-monthly/index.ts` | Same pattern -- capture the campaign record id and pass it when logging to email_logs (if it logs there; otherwise add logging) |

### 2. Fix the stacked bar chart double-counting

In `useNewsletterAnalytics.ts`, change the monthly series logic so `delivered` counts only emails that were delivered but NOT opened/clicked. This makes the stacked bars sum to the true total:
- `delivered_only` = delivered + sent (not opened/clicked)
- `opened_only` = opened (not clicked)
- `clicked` = clicked
- `bounced` = bounced

Update chart dataKeys accordingly.

### 3. Build the per-campaign expandable drill-down

Wire up the existing `expandedCampaign` state. When a campaign row is clicked, expand it to show a mini breakdown: delivered / opened / clicked / bounced counts from `email_logs` filtered by `campaign_id`. Add a new query in the hook that fetches per-campaign stats.

### 4. Add agent name resolution

Update the campaigns query to join profiles: select `created_by` and resolve first_name/last_name. Display an "Agent" column in the campaign table.

### 5. Add CSV export button

Add a "Download CSV" button to the campaign table that exports all visible campaign rows with their metrics.

### 6. Summary of files to change

| File | Changes |
|------|---------|
| `supabase/functions/newsletter-send/index.ts` | Add `campaign_id` column to both email_logs inserts |
| `supabase/functions/newsletter-template-send/index.ts` | Create campaign record; add `campaign_id` to email_logs inserts |
| `supabase/functions/newsletter-monthly/index.ts` | Pass campaign_id to email_logs if applicable |
| `src/hooks/useNewsletterAnalytics.ts` | Fix bar chart double-counting; add per-campaign breakdown query; add agent name join on campaigns |
| `src/components/newsletter/analytics/NewsletterAnalyticsDashboard.tsx` | Build expandable campaign rows; add Agent column; add CSV export; fix chart dataKeys |

