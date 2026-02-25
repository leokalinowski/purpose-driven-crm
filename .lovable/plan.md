

# Rebuild the Newsletter Analytics Sub-page

## Current State

The Analytics tab today is minimal:
- 4 KPI cards (total campaigns, total recipients, avg open rate, avg click-through rate)
- One area chart showing open rate and click rate over time
- A flat campaigns table with name, date, recipients, open rate, click rate, status
- A "Preview Newsletter" button that opens the old market-report preview dialog

Key problems:
- **Open/click rates are still fake** in the `newsletter-monthly` edge function (random numbers). The `newsletter-send` function was fixed to `0`, but the monthly one still generates fake data. The Resend webhook updates `event_emails` and `email_logs` but **never updates `newsletter_campaigns`** — so campaign-level open/click rates are never populated from real tracking data.
- The chart only shows two metrics and has no interactivity.
- No per-campaign drill-down, no bounce/complaint visibility, no agent-level breakdown, no date filtering.
- The "Preview Newsletter" button is for the old market-report system, not the template builder.

## Data Sources Available

| Table | Useful Columns | Notes |
|-------|---------------|-------|
| `newsletter_campaigns` | campaign_name, send_date, recipient_count, open_rate, click_through_rate, status, created_by | Campaign-level aggregates (currently fake rates) |
| `email_logs` | recipient_email, status, resend_email_id, email_type, agent_id, sent_at, error_message | Per-email tracking, updated by Resend webhook |
| `newsletter_schedules` | template_id, agent_id, status, send_at | Scheduled sends |
| `newsletter_templates` | name, blocks_json, agent_id | Templates |
| `monthly_runs` | agent_id, emails_sent, contacts_processed, run_date, status | Legacy run records |

## Plan

### 1. Fix the data pipeline (Resend webhook → campaign stats)

Update `resend-webhook/index.ts` to also recalculate `newsletter_campaigns` open/click rates when an `email.opened` or `email.clicked` event comes in. The webhook already has the `resend_email_id` — we need to correlate it back to a campaign (via `email_logs.metadata` or a new `campaign_id` column on `email_logs`).

**Approach**: Add a `campaign_id` column to `email_logs` (nullable UUID). When the newsletter-send and newsletter-template-send functions log emails, they include the campaign_id. The webhook then aggregates counts and updates the campaign record.

Also fix `newsletter-monthly/index.ts` lines 1132-1133 to use `0` instead of random values (same fix already applied to `newsletter-send`).

### 2. Redesign the Analytics tab UI

Replace the current flat layout with a richer dashboard:

**a) Date range filter bar** — "Last 7 days / 30 days / 90 days / All time" toggle at the top, filtering all cards and charts.

**b) Enhanced KPI cards (6 cards, 3x2 grid)**:
- Total Campaigns Sent
- Total Emails Delivered (from `email_logs` where status = delivered/opened/clicked)
- Avg Open Rate (with trend arrow vs previous period)
- Avg Click Rate (with trend arrow)
- Bounce Rate
- Unsubscribe count

**c) Two charts side by side**:
- **Left**: Open Rate vs Click Rate over time (line chart, already exists but improved with proper axis labels, formatted month names, and tooltips showing recipient count)
- **Right**: Email Volume bar chart (emails sent per month, stacked by status: delivered/opened/bounced)

**d) Campaign Performance Table** — enhanced with:
- Sortable columns
- Status badge with color coding
- Expandable row showing per-email breakdown (delivered / opened / clicked / bounced counts)
- Agent name column (joined from profiles via `created_by`)

**e) Remove the old "Preview Newsletter" button** — it opens the legacy market-report generator and doesn't belong on this page.

### 3. Files to create/modify

| File | Action | Description |
|------|--------|-------------|
| `src/pages/Newsletter.tsx` | Modify | Replace Analytics tab content with new `NewsletterAnalyticsDashboard` component; remove old Preview button and import |
| `src/components/newsletter/analytics/NewsletterAnalyticsDashboard.tsx` | Create | Main analytics dashboard with date filter, KPI cards, charts, and campaign table |
| `src/hooks/useNewsletterAnalytics.ts` | Modify | Add `email_logs` query for real delivery stats; add date range parameter; compute bounce rate and delivery metrics; add per-campaign email breakdown |
| `supabase/functions/resend-webhook/index.ts` | Modify | After updating `email_logs`, recalculate and update the parent `newsletter_campaigns` open/click rates |
| `supabase/functions/newsletter-monthly/index.ts` | Modify | Replace fake random open/click rates with `0` (2-line fix) |
| Migration SQL | Create | Add `campaign_id` column to `email_logs` table |

### 4. Technical details

**Date filtering**: The hook will accept a `dateRange` parameter (`7d | 30d | 90d | all`). Queries filter `newsletter_campaigns.send_date` and `email_logs.sent_at` accordingly.

**Real-time stats from email_logs**: Instead of relying solely on the (currently fake) campaign-level rates, query `email_logs` grouped by status to compute real delivered/opened/clicked/bounced counts. These become the source of truth for the KPI cards.

**Webhook campaign update logic**: When the webhook receives an open/click event, it looks up the `email_logs` row by `resend_email_id`, gets the `campaign_id`, then runs an aggregate query: `SELECT COUNT(*) FILTER (WHERE status = 'opened') as opens, COUNT(*) as total FROM email_logs WHERE campaign_id = X`. Updates the campaign's `open_rate` and `click_through_rate`.

**Campaign table agent join**: Use `.select('*, profiles!newsletter_campaigns_created_by_fkey(first_name, last_name)')` to get agent names inline.

