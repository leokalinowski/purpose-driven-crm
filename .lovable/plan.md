

# Fix Editor Background & Global Font Inheritance

## Three Problems Found

1. **Editor background fills everything** — Line 228 of `NewsletterBuilder.tsx` applies `backgroundColor` directly on the canvas wrapper. But the preview HTML (line 236-238 of `renderBlocksToHtml.ts`) uses a two-layer structure: outer wrapper with background color, inner white content area. The editor needs to match this structure.

2. **Fonts still differ in preview HTML** — `renderBlocksToHtml.ts` line 87 still has `font-family:Georgia,serif` hardcoded on the listings heading. This overrides the global font set on `<body>`.

3. **Fonts don't inherit in editor** — `BlockRenderer.tsx` line 209 uses Tailwind's `prose prose-sm` class on text blocks, which applies its own `font-family` and overrides the inherited global font.

## Changes

### `NewsletterBuilder.tsx` (line 228)
Replace single wrapper with two-layer structure matching the preview:
- **Outer div**: background color from `globalStyles.backgroundColor`, padding
- **Inner div**: white background (`#ffffff`), border-radius, `fontFamily` from global styles, content width from `globalStyles.contentWidth`

```
// Before (line 228):
<div className="rounded-xl shadow-sm border p-6 min-h-[600px]" style={{ backgroundColor: globalStyles.backgroundColor, fontFamily: globalStyles.fontFamily }}>

// After:
<div className="rounded-xl shadow-sm min-h-[600px]" style={{ backgroundColor: globalStyles.backgroundColor, padding: '24px 16px' }}>
  <div className="mx-auto rounded-lg border p-6" style={{ maxWidth: globalStyles.contentWidth || 640, backgroundColor: '#ffffff', fontFamily: globalStyles.fontFamily }}>
```
And add a closing `</div>` on what is currently line 238.

### `renderBlocksToHtml.ts` (line 87)
Remove `font-family:Georgia,serif;` from the listings `<h3>` tag so it inherits the global font.

### `BlockRenderer.tsx` (line 209)
Remove `prose prose-sm` from the text block's className. These Tailwind typography classes apply their own font-family, overriding inheritance. Keep only `max-w-none`.

