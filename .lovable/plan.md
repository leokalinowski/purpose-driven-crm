

# Use Global Body Text Color Across All Blocks

## Problem

The Global Styles panel has a "Body Text Color" (`bodyColor`) setting, but it is ignored in both the editor and the preview. Every block hardcodes its own fallback color (`#1a1a1a` for headings, `#374151` for text), so changing the global body color has no effect.

## Approach

Make blocks inherit the global body color by default, while still allowing per-block color overrides when the user explicitly sets one.

## Changes

### 1. Editor canvas — `NewsletterBuilder.tsx` (line 229)
Add `color: globalStyles.bodyColor` to the inner content div's inline style, so all child blocks inherit it.

### 2. Block defaults — `types.ts` (BLOCK_DEFAULTS, lines ~129-130)
Change heading and text default colors from hardcoded values to empty string `''`:
- `heading.color`: `'#1a1a1a'` → `''`
- `text.color`: `'#374151'` → `''`

This means new blocks will have no explicit color and will inherit from the global style.

### 3. Editor block rendering — `BlockRenderer.tsx` (lines 200, 210)
Only apply inline `color` when `block.props.color` is truthy (non-empty). If empty, omit it so the block inherits from the canvas wrapper:
- Line 200: `color: block.props.color || undefined`
- Line 210: `color: block.props.color || undefined`

### 4. Preview HTML rendering — `renderBlocksToHtml.ts`

Pass `globalStyles` into render functions so they can use the body color as fallback:

- **`renderHeading`** (line 23): Change fallback from `'#1a1a1a'` to use inherited color — remove `color:` from inline style when `props.color` is empty, letting it inherit from `<body style="color:${gs.bodyColor}">` which is already set on line 232.
- **`renderText`** (line 32): Same — remove `color:` when `props.color` is empty.

Concretely:
- Heading: `color:${props.color || '#1a1a1a'}` → only emit color style if `props.color` is truthy
- Text: `color:${props.color || '#374151'}` → same

The `<body>` tag already sets `color:${gs.bodyColor}` (line 232 of renderBlocksToHtml), so inheritance will work automatically once we stop overriding it in every block.

## Summary of files

| File | Change |
|------|--------|
| `NewsletterBuilder.tsx` | Add `color: globalStyles.bodyColor` to canvas inner div |
| `types.ts` | Default heading/text color → `''` |
| `BlockRenderer.tsx` | Only apply color when non-empty |
| `renderBlocksToHtml.ts` | Only emit color style when non-empty; rely on body color inheritance |

Existing templates with explicitly saved colors will keep working. Only new blocks will default to inheriting the global color.

