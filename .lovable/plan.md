

## Plan: Newsletter Improvements — AI for Users, Schedule Send, Listing Links, Bug Fixes

Four changes plus a bug audit.

---

### 1. Allow Non-Admin Users to Generate AI Newsletters

**Problem**: The `generate-ai-newsletter` edge function hard-checks for admin role (line 27-33). Regular agents cannot use it.

**Fix**:
- **Edge function** (`supabase/functions/generate-ai-newsletter/index.ts`): Replace the admin-only check with a check that allows the authenticated user to generate for *themselves* (`user.id === agent_id`) OR be an admin. Remove the `agent_id` requirement for non-admins — default to `user.id`.
- **Newsletter page** (`src/pages/Newsletter.tsx`): Add an "AI Generate" button in the TemplateList or as a standalone action on the Newsletter page that opens a simple dialog (topic hint textarea + generate button). This reuses the same prompt pattern from AdminNewsletter but simplified for self-service.
- **New component** (`src/components/newsletter/AIGenerateDialog.tsx`): Dialog with topic input, generates for the current user's `user.id`, navigates to the builder on success.

**Files**:
- `supabase/functions/generate-ai-newsletter/index.ts` — relax role check
- `src/components/newsletter/AIGenerateDialog.tsx` — new self-service dialog
- `src/components/newsletter/builder/TemplateList.tsx` — add "AI Generate" button next to "New Template"

---

### 2. Add "Schedule for Later" to SendSchedulePanel

**Problem**: The panel only has "Send Now". There's no way to schedule a send for a future date/time.

**Approach**: Add a date-time picker and a "Schedule" button. When scheduled, create a `newsletter_campaigns` record with `status: 'scheduled'` and `scheduled_at` timestamp + store `template_id`, `agent_id`, `subject`, `sender_name`, `recipient_filter` in `metadata`. A cron-invokable function will pick up scheduled campaigns and trigger sends.

**Changes**:
- **Migration**: Add `scheduled_at` (timestamptz, nullable) and `metadata` (jsonb, nullable) columns to `newsletter_campaigns`.
- **SendSchedulePanel** (`src/components/newsletter/builder/SendSchedulePanel.tsx`): Add a "Schedule" tab/section with date-time input. On schedule, insert into `newsletter_campaigns` with status `'scheduled'` and the send parameters in metadata.
- **New edge function** (`supabase/functions/newsletter-scheduled-send/index.ts`): Cron-triggered function that finds campaigns with `status = 'scheduled'` and `scheduled_at <= now()`, then calls `newsletter-template-send` internally for each.
- **Config**: Add the function to `supabase/config.toml`.

**Files**:
- Migration — add columns to `newsletter_campaigns`
- `src/components/newsletter/builder/SendSchedulePanel.tsx` — add schedule UI
- `supabase/functions/newsletter-scheduled-send/index.ts` — new cron processor
- `supabase/config.toml` — register function

---

### 3. Add Clickable Links to Listings Block

**Problem**: Listings in the email have no links back to the property URL. Each `ListingItem` already stores `url` but neither `renderBlocksToHtml.ts` (client preview) nor the edge function's server-side renderer wraps listings in `<a>` tags.

**Fix**: In both renderers, wrap each listing card in an `<a href="${l.url}">` tag (or wrap the image + a "View Listing" link in the card). The `url` field is already populated by the scraper.

Also add "View Listing" text link in the `BlockRenderer.tsx` preview for visual consistency.

**Files**:
- `src/components/newsletter/builder/renderBlocksToHtml.ts` — wrap listings in links
- `src/components/newsletter/builder/BlockRenderer.tsx` — add "View Listing" link in preview
- `supabase/functions/newsletter-template-send/index.ts` — wrap server-side listings in links

---

### 4. Bugs, Inconsistencies, and Improvements Found

**Bug A — `getClaims` may not exist**: The `newsletter-template-send` edge function uses `supabaseAuth.auth.getClaims(token)` (line 339). This method was added in supabase-js v2.50+, but the edge function imports `@supabase/supabase-js@2.7.1` (line 2). This will fail at runtime. Fix: use `getUser(token)` instead, which works on all v2 versions.

**Bug B — Listing `url` field not preserved in ListingItem type**: The `ListingItem` type in `types.ts` has `url: string` but when the AI generates blocks, it doesn't include a `url` for listings. This is fine since AI doesn't generate listing blocks, but the field should be displayed in the BlockSettings listing card so users can verify/edit the URL.

**Bug C — Send confirmation can trigger double-send**: In `SendSchedulePanel`, clicking "Yes, Send Now" in the AlertDialog calls `setShowConfirm(false)` then `handleSendNow()`. But `handleSendNow` is async and there's no guard against the dialog being opened again while sending is in progress. Fix: disable the "Send Now" button when `saving` is true (already done) — but also need to guard against the confirm dialog re-opening.

**Improvement A — Missing `full_name` in edge function profile fetch**: The `newsletter-template-send` function only fetches `first_name, last_name` for agent name, but the profile table also has `full_name` which some agents use. The generate-ai-newsletter function already handles this. Fix: add `full_name` to the profile select.

**Improvement B — Listing URL editable in settings**: The `ListingsSettings` component shows listing info but doesn't let users edit the property URL after scraping. Add a small "URL" input or at least display the URL.

**Files for fixes**:
- `supabase/functions/newsletter-template-send/index.ts` — fix `getClaims` → `getUser`, add `full_name`
- `src/components/newsletter/builder/SendSchedulePanel.tsx` — guard double-send
- `src/components/newsletter/builder/BlockSettings.tsx` — show listing URL

---

### Summary of All Files

| File | Change |
|------|--------|
| `supabase/functions/generate-ai-newsletter/index.ts` | Allow agents to generate for themselves |
| `src/components/newsletter/AIGenerateDialog.tsx` | New — self-service AI generation dialog |
| `src/components/newsletter/builder/TemplateList.tsx` | Add AI Generate button |
| Migration | Add `scheduled_at`, `metadata` to `newsletter_campaigns` |
| `src/components/newsletter/builder/SendSchedulePanel.tsx` | Add schedule date picker, fix double-send guard |
| `supabase/functions/newsletter-scheduled-send/index.ts` | New — cron processor for scheduled sends |
| `supabase/config.toml` | Register new function |
| `src/components/newsletter/builder/renderBlocksToHtml.ts` | Wrap listings in clickable links |
| `src/components/newsletter/builder/BlockRenderer.tsx` | Add "View Listing" link in preview |
| `supabase/functions/newsletter-template-send/index.ts` | Fix `getClaims` bug, add `full_name`, wrap listings in links |
| `src/components/newsletter/builder/BlockSettings.tsx` | Show/edit listing URL |

