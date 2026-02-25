

# Newsletter Builder: Comprehensive Fix Plan

## Issues Found

### Critical (broken functionality)

1. **"Create Template" / "New Template" buttons do nothing** -- `handleCreate` in `TemplateList.tsx` (line 27) returns early if `user` is null. In the preview environment, the user is not authenticated, so `saveTemplate` never runs and navigation never happens. Even when authenticated, the function navigates to `/newsletter-builder/:id` which is a standalone full-screen page outside `Layout` -- but the button **should** work for logged-in users. The root cause is the silent early return with no feedback. Fix: add a toast or redirect to auth when `user` is null, and also provide a fallback to open a new builder without saving first.

2. **Columns block is non-functional** -- `BlockRenderer` (line 159-163) renders a static "coming soon" placeholder. `BuilderCanvas` creates the block with `children: [[], []]` (line 24) but there is no UI to add child blocks into those column arrays. `BlockSettings` has no `columns` case at all -- selecting a columns block shows "No settings for this block type." Fix: implement a working columns block with drop zones per column and column count settings.

3. **Market Data block has settings but no meaningful editing** -- The settings panel (lines 119-135 of `BlockSettings.tsx`) only has header text, style selector, and a static note. The canvas preview (lines 128-134 of `BlockRenderer.tsx`) is a static placeholder. There is no way to select which metrics to show, no sample data preview, no ZIP code input for testing. Fix: add metric selection checkboxes and a sample data preview.

4. **Listings block has settings but minimal editing** -- Settings panel has count slider and grid/list toggle, but the canvas preview is just a placeholder. Fix: add a richer preview with sample listing cards.

### Missing Features

5. **No scheduling/sending system** -- There is no UI anywhere for: subject line, sender name/email, recipient selection, schedule date/time, send test, or send now. The existing `newsletter-send` edge function handles this server-side but there's no front-end interface tied to the new builder. Fix: add a "Send / Schedule" panel to the builder with all necessary fields.

6. **No `columns` case in `BlockSettings.tsx`** -- Selecting a columns block falls through to the default case (line 196-197) showing "No settings for this block type."

### Minor Issues

7. **Columns block HTML renderer has a math bug** -- `renderBlocksToHtml.ts` line 86: `const colWidth = Math.floor((100 - (gap * (colCount - 1)) / globalStyles.contentWidth * 100) / colCount)` -- operator precedence is wrong. The division by `contentWidth` only applies to part of the expression. This produces incorrect column widths.

8. **No delete confirmation feedback** -- The delete button in `TemplateList` opens an `AlertDialog` but provides no success toast after deletion.

9. **`html_raw` block settings only has a textarea** -- No preview of the rendered HTML on the canvas (line 164-168 of `BlockRenderer` just shows raw text).

10. **Social Icons block has no way to add custom links** -- Settings only show alignment and icon size. The `links` array in defaults is empty `[]` and there's no UI to add/edit social links.

## Implementation Plan

### 1. Fix "Create Template" Buttons

**File: `src/components/newsletter/builder/TemplateList.tsx`**
- If `user` is null, show a toast telling them to log in instead of silently returning
- Wrap the `saveTemplate` call in try/catch with error feedback
- If save fails, still allow navigating to `/newsletter-builder` (new unsaved template)

### 2. Implement Working Columns Block

**File: `src/components/newsletter/builder/BlockRenderer.tsx`**
- Replace the placeholder with a real multi-column layout
- Each column is a drop zone that accepts `BLOCK` items from the palette
- Render child blocks inside each column using recursive `BlockPreview`

**File: `src/components/newsletter/builder/BuilderCanvas.tsx`**
- Add support for dropping blocks into column children
- Pass a callback `onAddToColumn(blockId, columnIndex, blockType)` down to the column renderer

**File: `src/components/newsletter/builder/BlockSettings.tsx`**
- Add `columns` case with: column count selector (2 or 3), gap slider

### 3. Enhance Market Data Block

**File: `src/components/newsletter/builder/BlockSettings.tsx`**
- Add metric selection via checkboxes (median_sale_price, active_listings, days_on_market, price_per_sqft, inventory, new_listings, sold_listings)
- Add ZIP code input for preview testing

**File: `src/components/newsletter/builder/BlockRenderer.tsx`**
- Show a richer preview with sample metric cards/table based on selected style
- Display the selected metrics as mock data cards

### 4. Enhance Listings Block

**File: `src/components/newsletter/builder/BlockRenderer.tsx`**
- Show sample listing cards with placeholder images, addresses, and prices
- Respect the `count` and `style` (grid vs list) props visually

### 5. Add Social Icons Link Editor

**File: `src/components/newsletter/builder/BlockSettings.tsx`**
- Add UI to manage the `links` array: add/remove platform + URL pairs
- Platform dropdown (Facebook, Instagram, LinkedIn, Twitter/X, YouTube, TikTok)

### 6. Add Send/Schedule Panel

**New file: `src/components/newsletter/builder/SendSchedulePanel.tsx`**
- Subject line input
- Sender name (pre-filled from agent profile) and sender email (read-only, shows the system domain)
- Recipient selection: "All my contacts" or filter by tag/category
- Schedule: "Send Now" or date/time picker for scheduled send
- "Send Test Email" button (sends to the agent's own email)
- Stores schedule config in a new `newsletter_schedules` table or as fields on `newsletter_templates`

**New DB table: `newsletter_schedules`**
```sql
CREATE TABLE public.newsletter_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES newsletter_templates(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES auth.users(id),
  subject TEXT NOT NULL DEFAULT '',
  sender_name TEXT,
  recipient_filter JSONB DEFAULT '{"type": "all"}'::jsonb,
  scheduled_at TIMESTAMPTZ,
  status TEXT DEFAULT 'draft', -- draft, scheduled, sending, sent, failed
  sent_at TIMESTAMPTZ,
  recipient_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

RLS: Agents own their schedules; admins manage all.

**File: `src/components/newsletter/builder/NewsletterBuilder.tsx`**
- Add a "Send" button to the toolbar that opens the SendSchedulePanel as a slide-over or dialog

### 7. Fix Columns HTML Renderer Math

**File: `src/components/newsletter/builder/renderBlocksToHtml.ts`**
- Fix line 86 operator precedence:
  ```ts
  const colWidth = Math.floor(100 / colCount);
  ```
- Simplify: use equal-width columns with gap handled via padding

### 8. Fix HTML Raw Block Preview

**File: `src/components/newsletter/builder/BlockRenderer.tsx`**
- Render the raw HTML using `dangerouslySetInnerHTML` inside a sandboxed container with a "Raw HTML" label

### Files Summary

| Action | File |
|---|---|
| Modify | `src/components/newsletter/builder/TemplateList.tsx` |
| Modify | `src/components/newsletter/builder/BlockRenderer.tsx` |
| Modify | `src/components/newsletter/builder/BlockSettings.tsx` |
| Modify | `src/components/newsletter/builder/BuilderCanvas.tsx` |
| Modify | `src/components/newsletter/builder/NewsletterBuilder.tsx` |
| Modify | `src/components/newsletter/builder/renderBlocksToHtml.ts` |
| Create | `src/components/newsletter/builder/SendSchedulePanel.tsx` |
| Create | SQL migration for `newsletter_schedules` table |
| Modify | `src/hooks/useNewsletterTemplates.ts` (add schedule hook or separate hook) |

