

# Plan: Admin Newsletter Management Page Cleanup and Agent Page Template Layout

## Summary of Changes

There are 5 distinct tasks:

1. **Apply the card-gallery template layout to the Agent Newsletter page** (the `/newsletter` Builder tab)
2. **Fix the Edit button** in `AdminNewsletterTemplates` to navigate within the app instead of opening a new tab
3. **Delete all legacy `monthly_runs` data** and remove legacy run merging from the hook
4. **Review and fix Agent Settings**
5. **Delete the Market Data tab**

---

## 1. Agent Newsletter Page -- Match Admin Template Card Layout

The agent's `/newsletter` Builder tab currently uses `TemplateList` which renders an inline `<iframe>` thumbnail. The admin Templates tab uses a simpler card with a static `thumbnail_url` image or a `FileText` icon fallback (the screenshot the user shared and likes).

**Approach**: Update `AdminNewsletterTemplates.tsx` to use the same `TemplateThumbnail` iframe-based preview that `TemplateList` uses (rendering actual block content), so both pages show real template previews. This gives both pages a consistent, rich card layout. The admin version already has the agent name badge and filter -- that stays.

Specifically:
- Import `renderBlocksToHtml` and create the `TemplateThumbnail` component (same as in `TemplateList`) inside `AdminNewsletterTemplates`
- Replace the current `thumbnail_url` / `FileText` fallback with the iframe thumbnail rendering from `blocks_json` + `global_styles`
- Both pages now show the same live-rendered email preview thumbnails

## 2. Fix Edit Button -- Navigate Within App

In `AdminNewsletterTemplates.tsx` line 84, the Edit button does `window.open('/newsletter?template=...')` which opens a new browser tab. This should use React Router navigation instead.

**Fix**: Import `useNavigate` from `react-router-dom`, and change the onClick to `navigate(`/newsletter-builder/${t.id}`)` -- same pattern used in the agent's `TemplateList`.

## 3. Clean Up Campaign History -- Delete Legacy Runs

There are 16 rows in `monthly_runs` and 1 real campaign in `newsletter_campaigns`. The user wants to start fresh.

**Actions**:
- Run SQL: `DELETE FROM monthly_runs;` to clear all legacy data
- Run SQL: `DELETE FROM newsletter_campaigns;` to clear the single old campaign
- In `useAdminNewsletter.ts`: Remove the `monthly_runs` query entirely (lines 150-161), remove the legacy run merging logic (lines 184-202), remove the `runsLoading` from the loading state
- In `AdminNewsletterCampaigns.tsx`: Remove the `Legacy` badge logic and `source` column since everything is now template-based
- Update the `AdminCampaign` interface to drop the `source` field

## 4. Fix Agent Settings

The Agent Settings tab currently works but has UX issues:
- The `newsletter_settings` table only has 2 rows, so agents without a pre-existing row get defaults from the `getAgentSettings` fallback, but the **upsert works correctly** (it creates on first save). This is actually fine functionally.
- However, the settings concept is tied to the **old** `newsletter-send` monthly pipeline which auto-generates emails from market data CSVs. Since we've moved to the template builder, these schedule settings (day of month, hour) are no longer meaningful in the same way.

**Fix**: Reframe the Agent Settings tab to be useful for the new system:
- Keep the Enable/Disable toggle per agent (useful for admin to control who can send newsletters)
- Remove the "Day of Month" and "Hour (24h)" schedule fields since they were for the old auto-send pipeline. The new system uses the `SendSchedulePanel` for per-send scheduling.
- Show agent info: name, email, contact count, template count (already there)
- Add a "Last Sent" indicator by querying the most recent `newsletter_campaigns` entry per agent

## 5. Delete Market Data Tab

Remove the Market Data tab entirely from `AdminNewsletter.tsx`:
- Remove the tab trigger and content for `market-data`
- Remove imports for `CSVUploadManager` and `AdminNewsletterPreview`
- Change the tabs grid from `grid-cols-4` to `grid-cols-3`
- Remove `Database` icon import

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/admin/AdminNewsletterTemplates.tsx` | Add iframe thumbnail rendering from `renderBlocksToHtml`; fix Edit button to use `navigate()` instead of `window.open()` |
| `src/pages/AdminNewsletter.tsx` | Remove Market Data tab and its imports; change tabs to 3-col; simplify Agent Settings to remove schedule fields |
| `src/hooks/useAdminNewsletter.ts` | Remove `monthly_runs` query and legacy merging; drop `source` from `AdminCampaign` |
| `src/components/admin/AdminNewsletterCampaigns.tsx` | Remove `source`/`Legacy` badge references |
| Database | `DELETE FROM monthly_runs;` and `DELETE FROM newsletter_campaigns;` |

