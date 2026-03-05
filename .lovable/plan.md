

## Plan: Newsletter Bug Fixes, Responsiveness, and Improvements

After a thorough audit of the entire newsletter system — UI components, edge functions, hooks, rendering, and configuration — here are the issues found and fixes proposed.

---

### Bug 1: `NewsletterTaskCard` never shows completion state

The `hasCampaignThisWeek` prop is optional and `Newsletter.tsx` passes nothing (`<NewsletterTaskCard />`), so `isComplete` is always `false`. The card never shows the green "sent" state even when a campaign was sent this week.

**Fix**: Query `newsletter_campaigns` in the `NewsletterTaskCard` itself (or in a small hook) to check if a campaign with `status = 'sent'` exists within the current week for the agent. Remove the prop dependency.

**File**: `src/components/newsletter/NewsletterTaskCard.tsx`

---

### Bug 2: `newsletter-template-send` uses old import style

Line 2 uses `https://esm.sh/@supabase/supabase-js@2.7.1` — an old pinned version. The `newsletter-scheduled-send` function uses `npm:@supabase/supabase-js@2`. While the `getUser` fix was applied, the import should be updated to match the project convention (`npm:` specifier) for consistency and to avoid potential Deno caching/deployment issues.

**Fix**: Update import on line 2 to `import { createClient } from 'npm:@supabase/supabase-js@2';` and also update the `serve` import to `Deno.serve`.

**File**: `supabase/functions/newsletter-template-send/index.ts` (lines 1-2)

---

### Bug 3: `newsletter-scheduled-send` uses service role key as Bearer token

Line 73 calls `newsletter-template-send` with `Authorization: Bearer ${supabaseServiceKey}`. But `newsletter-template-send` validates the bearer token via `auth.getUser(token)` — a service role key is NOT a valid user JWT, so `getUser` will fail and the scheduled send will always return 401.

**Fix**: The scheduled-send function should either:
- Use the `SUPABASE_ANON_KEY` and construct a proper admin-level call, OR
- Skip the auth check in `newsletter-template-send` when called with the service role key (check if the key matches the service role key), OR  
- Best approach: have `newsletter-scheduled-send` directly execute the send logic using the service role client rather than calling the other function via HTTP.

The simplest fix is to add a `X-Service-Key` header check in `newsletter-template-send` that bypasses auth when the service role key matches — similar to how other edge functions handle cron calls with `X-Cron-Job`.

**Files**: 
- `supabase/functions/newsletter-template-send/index.ts` — add service-key bypass
- `supabase/functions/newsletter-scheduled-send/index.ts` — pass `X-Service-Key` header

---

### Bug 4: No cron job registered for `newsletter-scheduled-send`

The function exists and is configured in `config.toml`, but no `pg_cron` job has been set up to actually invoke it. Without the cron job, scheduled newsletters will never be processed.

**Fix**: Create a `pg_cron` schedule (run every 5 minutes) that calls the function with the required `X-Cron-Job: true` header. This must be run via SQL insert, not a migration file (contains project-specific data).

**Action**: Use the Supabase SQL tool to register the cron job.

---

### Bug 5: Builder not responsive on mobile

The `NewsletterBuilder` component uses a rigid 3-panel layout (`w-[220px]` palette + flex center + `w-[280px]` settings) with no responsive breakpoints. On small screens, the panels overflow or crush the canvas.

**Fix**: Hide the palette and settings panels on small screens, and show them as collapsible drawers or tabs. On mobile, only show the canvas with a floating action bar for block palette and settings.

**Files**: `src/components/newsletter/builder/NewsletterBuilder.tsx`

---

### Bug 6: `TemplateList` buttons overflow on mobile

The template card action buttons (Edit, Send, Copy, Delete) are all inline with no wrapping. On narrow screens, they overflow the card.

**Fix**: Add `flex-wrap` to the button row and make the layout stack on mobile.

**File**: `src/components/newsletter/builder/TemplateList.tsx` (line 170)

---

### Improvement 1: `SendSchedulePanel` profile fetch missing `full_name`

Line 54-59 only fetches `first_name, last_name` but the profiles table also has `full_name` which some agents use. This means the sender name could be incomplete.

**Fix**: Add `full_name` to the select and use it with fallback: `data.full_name || \`${data.first_name} ${data.last_name}\``.

**File**: `src/components/newsletter/builder/SendSchedulePanel.tsx` (line 55)

---

### Improvement 2: `useNewsletterTaskSettings` uses `as any` casts

The hook casts the Supabase client `as any` because the `newsletter_task_settings` table isn't in the generated types. This was likely because the types weren't regenerated after the migration.

**Fix**: The types file should already include the table (from the previous implementation). Verify and remove the `as any` casts if possible, or leave as-is if the types weren't regenerated.

**File**: `src/hooks/useNewsletterTaskSettings.ts`

---

### Improvement 3: AI Generate dialog should disable textarea for non-selected prompts more clearly

The current disabled state makes it look like the text is locked. It would be better to show a visual indicator that clicking selects the prompt type.

**Fix**: Minor — dim the textarea opacity more clearly when disabled.

**File**: `src/components/newsletter/AIGenerateDialog.tsx`

---

### Summary of Changes

| File | Change |
|------|--------|
| `src/components/newsletter/NewsletterTaskCard.tsx` | Self-query campaigns for completion state instead of relying on unused prop |
| `supabase/functions/newsletter-template-send/index.ts` | Update import to `npm:`, add service-key auth bypass |
| `supabase/functions/newsletter-scheduled-send/index.ts` | Pass `X-Service-Key` header instead of Bearer service key |
| SQL (via Supabase tool) | Register `pg_cron` job for scheduled sends |
| `src/components/newsletter/builder/NewsletterBuilder.tsx` | Make 3-panel layout responsive (collapse panels on mobile) |
| `src/components/newsletter/builder/TemplateList.tsx` | Fix button overflow on mobile |
| `src/components/newsletter/builder/SendSchedulePanel.tsx` | Fetch `full_name` for sender name |

