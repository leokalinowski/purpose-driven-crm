

# E-Newsletter Builder — Comprehensive Audit

After examining every file in the builder system (`renderBlocksToHtml.ts`, `BlockRenderer.tsx`, `BlockSettings.tsx`, `BuilderCanvas.tsx`, `NewsletterBuilder.tsx`, `PreviewPanel.tsx`, `SendSchedulePanel.tsx`, `TemplateList.tsx`, `types.ts`, `useNewsletterTemplates.ts`, `Newsletter.tsx`, and `newsletter-send/index.ts`), here is everything I found.

---

## Critical: Send Flow is Broken

The **Send** and **Send Test** buttons in `SendSchedulePanel.tsx` call the `newsletter-send` edge function with `template_id`, `subject`, `sender_name`, and `recipient_filter`. However, the **actual** `newsletter-send` edge function is the **old market-report generator** — it expects `{ agent_id, dry_run, campaign_name }` and generates emails from scratch using Grok/market data. It has zero awareness of the template builder, `template_id`, `blocks_json`, or `renderBlocksToHtml`.

This means:
- Clicking **"Send Now"** invokes the old market report pipeline, ignoring the template entirely.
- Clicking **"Send Test"** does the same. The user's carefully designed template is never used.
- The `newsletter_schedules` table gets a record, but nothing processes scheduled entries.

### Fix
Create a new edge function (or a new code path in the existing one) that:
1. Fetches the template by `template_id` from `newsletter_templates`.
2. Calls `renderBlocksToHtml` (server-side port) to produce the final HTML.
3. Replaces agent placeholders with real profile data.
4. Sends via Resend to the filtered contact list.

---

## High Priority Issues

### 1. `iconSize` setting is ignored everywhere
The Social Icons block has an `iconSize` prop (configurable 20-48px via slider in settings). Neither `BlockRenderer.tsx` nor `renderBlocksToHtml.ts` uses it. The editor renders Lucide icons at a hardcoded `size={16}`, and the preview renders text pills with hardcoded `font-size:13px`. The setting does nothing.

**Fix**: Use `block.props.iconSize` for the Lucide icon `size` prop in the editor, and scale the pill font-size/padding proportionally in the preview.

### 2. Fake analytics data
Lines 706-707 of `newsletter-send/index.ts`:
```
const openRate = Math.random() * 30 + 15; // Placeholder
const clickRate = Math.random() * 8 + 2;  // Placeholder
```
Open and click rates are **randomly generated** and stored as real data. The Analytics tab displays these fake numbers as if they were real metrics.

### 3. Columns block loses children when column count changes
In `BlockSettings.tsx`, changing from 2 to 3 columns (or vice versa) calls `onUpdate({ columns: Number(v) })`, which updates the prop but does NOT adjust `block.children`. If you switch from 3 columns back to 2, the third column's content silently disappears (it's still in data but `cols.slice(0, colCount)` in the renderer hides it). Switching from 2→3 shows an empty third column with no way to recover previous content.

### 4. No unsubscribe link in template-builder emails
The old newsletter system appends a CAN-SPAM compliant footer with an unsubscribe link. The new template builder has no mechanism to inject one. Sending emails without an unsubscribe link violates CAN-SPAM and will get the domain flagged.

---

## Medium Priority Issues

### 5. Duplicate toast on delete
`TemplateList.tsx` line 89 calls `toast({ title: 'Template deleted' })` manually, but `useNewsletterTemplates.ts` line 80 also toasts `'Template deleted'` in `onSuccess`. Users see two toasts.

### 6. Agent bio website link has double-escaped href
In `renderBlocksToHtml.ts`, the `renderAgentBio` function renders:
```html
<a href="{{agent_website}}">{{agent_website}}</a>
```
Then `replaceAgentPlaceholders` calls `escapeHtml(value)` on the website URL, replacing `&` with `&amp;`. Line 241 tries to fix this by un-escaping the `href`, but the regex is fragile — it compares `href="${escapeHtml(agent.website)}"` which only works if the escaped version exactly matches. URLs with `&` characters could still break.

### 7. Autosave triggers on every keystroke (debounce helps but toast spam)
The autosave fires after 2 seconds of inactivity, which is good, but each save triggers a `toast({ title: 'Template saved' })` from the mutation hook. Typing in a heading field produces a save toast every ~2 seconds. This is noisy.

**Fix**: Suppress the toast for autosaves (only show it on manual save clicks).

### 8. Template thumbnails render full iframes
`TemplateList.tsx` uses `TemplateThumbnail` which creates a full `<iframe>` with `srcDoc` for each template card. With many templates, this creates N iframes on the page, each running `renderBlocksToHtml`. Performance degrades with scale.

### 9. Social icons alignment not applied in editor
`BlockRenderer.tsx` line 345 sets `style={{ textAlign: block.props.align }}` on the outer container, but the inner `<div>` at line 347 has `className="flex gap-3 justify-center flex-wrap"` which overrides the alignment with `justify-center`. Left/right alignment is ignored in the editor.

### 10. `html_raw` block is an XSS vector in the editor
Line 414: `<div dangerouslySetInnerHTML={{ __html: block.props.html }} />` renders arbitrary HTML in the editor. While this is somewhat expected for a "raw HTML" block, there's no sanitization or sandboxing. A `<script>` tag or event handler in the HTML field would execute in the app context.

---

## Low Priority / Polish

### 11. Missing `key` warning potential
`BlockRenderer.tsx` line 348 uses `key={i}` (array index) for social links. If links are reordered or deleted, React may not properly reconcile.

### 12. No loading state when scraping listings
There's a loading spinner on the button, but no skeleton/placeholder in the canvas while a listing is being scraped.

### 13. Columns default mismatch
`BLOCK_DEFAULTS` sets `columns: 2`, and `BuilderCanvas.tsx` creates `children: [[], []]`. But if a user changes to 3 columns, the `children` array still has 2 entries. The `ColumnDropZone` renders `cols.slice(0, colCount)` which would try to render 3 but only have 2, causing the third column to be undefined.

### 14. No undo/redo
There's no history stack for block operations. Accidentally deleting a complex block or its content is irreversible (until the next autosave overwrites).

---

## Proposed Fix Priority

| # | Issue | Severity | Files |
|---|-------|----------|-------|
| 1 | Send flow doesn't use templates | Critical | `SendSchedulePanel.tsx`, new edge function |
| 2 | `iconSize` ignored | High | `BlockRenderer.tsx`, `renderBlocksToHtml.ts` |
| 3 | Fake analytics | High | `newsletter-send/index.ts` |
| 4 | Column children lost on count change | High | `BlockSettings.tsx` or `BuilderCanvas.tsx` |
| 5 | No unsubscribe in builder emails | High | New edge function / `renderBlocksToHtml.ts` |
| 6 | Duplicate delete toast | Medium | `TemplateList.tsx` |
| 7 | Website href escaping | Medium | `renderBlocksToHtml.ts` |
| 8 | Autosave toast spam | Medium | `NewsletterBuilder.tsx`, `useNewsletterTemplates.ts` |
| 9 | Social icon alignment in editor | Medium | `BlockRenderer.tsx` |
| 10 | Iframe thumbnail perf | Low | `TemplateList.tsx` |
| 11 | Raw HTML XSS | Low | `BlockRenderer.tsx` |

I'd recommend tackling these in batches. Which issues would you like me to fix first?

