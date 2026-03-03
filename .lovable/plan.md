

## Plan: Fix Default Email Templates and Colors Not Applying

### Root Cause

When no saved template exists for a new event, `EmailTemplateEditor` (line 100) calls `getDefaultEmailTemplate(emailType)` from `src/utils/emailTemplateBuilder.ts`. This utility contains the **old, hardcoded** email HTML with old copy (e.g. "This is a friendly reminder...") and old headings (e.g. "Event Reminder" instead of "Just One Week Away!").

This old HTML is then passed as `htmlContent` to `VisualEmailEditor`, which **parses it** and extracts the old headings/paragraphs from it — completely overriding the new `DEFAULT_HEADINGS` and `DEFAULT_PARAGRAPHS` that were added to `VisualEmailEditor.tsx`.

For colors: the old HTML in `emailTemplateBuilder.ts` uses `{primary_color}` placeholders correctly, but `parseHtmlToData()` in the VisualEmailEditor (lines 378-381) extracts colors via regex looking for raw hex values in `linear-gradient`. Since the placeholders aren't hex values, extraction fails, and the parsed result has no color — so `getDefaultData` defaults apply. But `getDefaultData` receives `agentColors` correctly. The real issue is that `parseHtmlToData` returns `undefined` for colors (no match), so the `{ ...defaults, ...parsed }` merge doesn't override — **this part actually works**. Let me re-check...

Actually, the `{ ...defaults, ...parsed }` merge: if `parsed.primaryColor` is `undefined`, spreading it over defaults keeps the default. So colors from `agentColors` should work. The user's complaint about colors may be about the **preview** rendering the `{primary_color}` placeholder literally, or the old `emailTemplateBuilder.ts` templates being what shows in preview.

**The fix**: Stop using the old `getDefaultEmailTemplate()` fallback. Instead, when no template exists, pass **empty** `htmlContent` to `VisualEmailEditor` so it uses its own `getDefaultData()` with the new copy and agent colors, then let it generate the HTML.

### Changes

| File | Change |
|---|---|
| `src/components/events/email/EmailTemplateEditor.tsx` | When no template exists, set `htmlContent` to empty string `''` instead of calling `getDefaultEmailTemplate(emailType)`. This lets `VisualEmailEditor` initialize from its own defaults (new copy + agent colors). |

This is a one-line fix: change line 100-102 from:
```typescript
const defaultTemplate = getDefaultEmailTemplate(emailType)
setSubject(DEFAULT_SUBJECTS[emailType] || "You're Invited to {event_title}")
setHtmlContent(defaultTemplate)
```
to:
```typescript
setSubject(DEFAULT_SUBJECTS[emailType] || "You're Invited to {event_title}")
setHtmlContent('')
```

The `VisualEmailEditor` already handles empty `htmlContent` correctly (line 96): it falls back to `getDefaultData(emailType, agentColors)` which has all the new copy and uses the agent's branding colors.

