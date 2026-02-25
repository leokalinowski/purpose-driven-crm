

# Rebuild Admin Newsletter Management Page

## Current State

The Admin Newsletter Management page (`/admin/newsletter`) has **6 tabs**, most of which are legacy artifacts from the old CSV-based market-report newsletter system:

1. **CSV Upload** -- Uploads market data CSVs for the old AI-generated market report pipeline. No longer relevant to the new template builder workflow.
2. **Test Preview** -- Calls the `market-data-grok` edge function to preview old-style AI-generated emails by ZIP code. Not connected to the template builder.
3. **Send Newsletter** -- `NewsletterSendManager` component that sends via the old `newsletter-send` function (CSV market data + AI generation). Duplicates functionality now available in the template builder's Send panel.
4. **Agent Settings** -- Per-agent enable/disable toggle and schedule (day of month, hour). Triggers the old `newsletter-send` function per agent.
5. **Campaign History** -- Shows `monthly_runs` table data (the legacy run tracker). Does not show `newsletter_campaigns` records created by the new template-send flow.
6. **Cost Tracking** -- Placeholder component with no implementation.

**Core problem**: This page was built entirely around the old "upload CSV → Grok AI generates email per ZIP code" pipeline. The new system uses a drag-and-drop template builder with `newsletter-template-send`. The admin page needs to be rebuilt to manage the new workflow while preserving any legacy features that are still in use.

## Plan

### New Tab Structure (4 tabs)

1. **Templates** -- Admin view of all agents' templates (not just the logged-in user's). Shows agent name, template name, last updated, and a "Preview" action. Allows sending on behalf of any agent.
2. **Campaigns** -- Unified campaign history pulling from both `newsletter_campaigns` and `monthly_runs`. Shows delivery stats from `email_logs`, agent name, status badge, and expandable drill-down (reusing patterns from the analytics dashboard).
3. **Agent Settings** -- Keep existing agent enable/disable and scheduling controls, cleaned up. Add a column showing how many templates each agent has.
4. **Market Data** -- Move the CSV Upload and Test Preview here as a secondary tool (some agents may still use the market-report pipeline). Consolidate into a single tab instead of two.

Remove the "Cost Tracking" tab entirely (placeholder with no backing table). Remove the top-level "Test Mode" toggle (test sends are handled per-action in the template builder's Send panel).

### Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/pages/AdminNewsletter.tsx` | Rewrite | New 4-tab layout with Templates, Campaigns, Agent Settings, Market Data |
| `src/components/admin/AdminNewsletterTemplates.tsx` | Create | Cross-agent template gallery with agent selector, preview thumbnails, and "Send as Agent" action |
| `src/components/admin/AdminNewsletterCampaigns.tsx` | Create | Unified campaign table from `newsletter_campaigns` + `monthly_runs`, with email_logs breakdown, agent names, status badges, date filtering |
| `src/hooks/useAdminNewsletter.ts` | Modify | Add query for all templates across agents; add `newsletter_campaigns` query with agent profile join; keep existing agent settings logic |
| `src/components/admin/NewsletterSendManager.tsx` | Remove import | No longer needed as a separate tab; sending is done from the Templates tab |
| `src/components/admin/NewsletterCostTracking.tsx` | Remove import | Placeholder with no backing data |

### Technical Details

**Cross-agent template query**: Query `newsletter_templates` without filtering by `agent_id`, join with `profiles` on `agent_id` to show agent names. Admin RLS should allow this (admins can read all rows).

**Unified campaign history**: Query `newsletter_campaigns` ordered by `created_at` desc, joined with `profiles` on `created_by`. Also query `monthly_runs` and merge into the same table format. Show real delivery metrics by joining `email_logs` grouped by `campaign_id`.

**Send as Agent**: From the Templates tab, admin selects a template and clicks "Send". This opens the same `SendSchedulePanel` dialog but pre-fills the `agent_id` from the template's owner (not the admin's ID). The edge function already accepts `agent_id` as a parameter.

**Agent Settings tab**: Reuse existing `useAdminNewsletter` hook logic for settings. Add a count of templates per agent from the templates query.

**Market Data tab**: Combine `CSVUploadManager` and `AdminNewsletterPreview` into a single tab, removing the need for two separate tabs.

