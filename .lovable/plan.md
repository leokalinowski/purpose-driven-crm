

# Global Font + Preview Rendering Fixes

## Issue 1: Global Font

Currently every block hardcodes its own `font-family` inline (`Georgia, serif`). The global `fontFamily` is set on `<body>` but gets overridden by every block's inline style. This means changing the global font has no effect.

**Fix**: Remove per-block `font-family` from inline styles in `renderBlocksToHtml.ts`. Instead, pass `globalStyles.fontFamily` into each render function and only apply it if the block has explicitly overridden it (different from global). Since the `<body>` already sets `font-family` from global styles, child elements will inherit it automatically. Also remove the `fontFamily` field from `HeadingProps`, `TextProps`, and the block defaults in `types.ts`, and remove the font family selector from `BlockSettings.tsx` for heading/text blocks.

**Files**:
- `renderBlocksToHtml.ts` — Remove hardcoded `font-family` from `renderHeading`, `renderText`, `renderButton`, `renderAgentBio`, `renderListings`. Let them inherit from body.
- `types.ts` — Remove `fontFamily` from `HeadingProps`, `TextProps`, and from `BLOCK_DEFAULTS` for heading and text.
- `BlockSettings.tsx` — Remove the font family input/select for heading and text blocks.

## Issue 2: Preview Doesn't Match Editor

Looking at the screenshots: the editor (image-64) shows the agent bio as a separate block below the 2-column layout. But the preview (images 65-66) shows agent bio content (name, email, equal housing) appearing inside the right column mixed with the listings block.

The root cause is likely that the `renderAgentBio` function outputs loose `{{agent_headshot}}` and `{{agent_logo}}` placeholders as raw text (not wrapped in tags). When `replaceAgentPlaceholders` runs, the regex `<p[^>]*>[^<]*{{agent_...}}[^<]*</p>` fails to match these because the headshot/logo placeholders aren't inside `<p>` tags — they're bare text inside a `<div>`. When they have no value, the fallback regex `[^\n]*\{\{agent_headshot\}\}[^\n]*` grabs everything on that line, which can accidentally eat adjacent HTML and break the structure.

**Fix**: Wrap the headshot and logo placeholders in their own `<div>` tags so the removal regex works cleanly. Also ensure each placeholder line is self-contained.

Additionally, the listings block heading "Featured Listings" should not appear when placed inside a column — it should only show the listing cards. The heading is redundant when the block is nested.

**Files**:
- `renderBlocksToHtml.ts` — Wrap `{{agent_headshot}}` and `{{agent_logo}}` in `<div>` tags. Update removal regex to target these `<div>` wrappers. Ensure the `replaceAgentPlaceholders` function cleanly removes empty placeholders without eating adjacent HTML.

## Summary of Changes

| File | Changes |
|---|---|
| `renderBlocksToHtml.ts` | Remove per-block `font-family` inline styles (inherit from body). Fix agent bio placeholder wrapping so removal doesn't break HTML structure. |
| `types.ts` | Remove `fontFamily` from `HeadingProps`, `TextProps`, and their defaults in `BLOCK_DEFAULTS`. |
| `BlockSettings.tsx` | Remove font family selector from heading and text block settings. |

