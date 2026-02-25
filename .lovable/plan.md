

# E-Newsletter Builder — Audit Status

## ✅ Fixed Issues

| # | Issue | Fix |
|---|-------|-----|
| 1 | **Send flow doesn't use templates** | Created `newsletter-template-send` edge function that fetches template, renders HTML server-side, replaces agent placeholders, adds unsubscribe footer, and sends via Resend. Updated `SendSchedulePanel.tsx` to call the new function. |
| 2 | **`iconSize` ignored** | Now used in both `BlockRenderer.tsx` (Lucide icon size) and `renderBlocksToHtml.ts` (proportional font-size/padding). |
| 3 | **Fake analytics** | Replaced `Math.random()` rates with `0` — will be updated by Resend webhook tracking. |
| 4 | **Column children lost on count change** | `BlockSettings.tsx` passes `_syncChildren` flag; `NewsletterBuilder.tsx` syncs the `children` array length on column count change. |
| 5 | **No unsubscribe in builder emails** | `newsletter-template-send` injects a CAN-SPAM compliant unsubscribe footer with HMAC-signed tokens + `List-Unsubscribe` headers. |
| 6 | **Duplicate delete toast** | Removed manual toast from `TemplateList.tsx`; hook's `onSuccess` toast remains. |
| 7 | **Website href escaping** | Rewrote placeholder replacement to handle `href` attributes separately (no HTML-escaping for URLs). |
| 8 | **Autosave toast spam** | Added `_silent` flag to save mutation; autosaves suppress toast, manual save shows it. |
| 9 | **Social icon alignment in editor** | Replaced hardcoded `justify-center` with dynamic `justify-start/center/end` based on `block.props.align`. |
| 10 | **Agent bio layout toggle** | Both horizontal (table-based) and vertical layouts now render correctly in editor and preview. |

## Remaining (Lower Priority)

| # | Issue | Status |
|---|-------|--------|
| 10 | Iframe thumbnail performance | Not fixed — would need lazy loading or static screenshots |
| 11 | Raw HTML XSS in editor | Not fixed — acceptable risk for admin-only feature |
| 12 | No undo/redo | Not fixed — would need history stack implementation |
| 13 | Scheduled sends processing | `newsletter_schedules` table has records but no cron processes them |
