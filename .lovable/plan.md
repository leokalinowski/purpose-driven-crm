

# Fix Image Alignment in Preview & Social Media Icons

## Two Issues

### 1. Image alignment broken in preview HTML

In `renderBlocksToHtml.ts` line 39, the `<img>` has `display:block`. The parent `<div>` uses `text-align` for alignment (line 41). But `text-align` only affects **inline** or **inline-block** elements -- it has no effect on `display:block` elements. So images always render left-aligned in the preview regardless of the alignment setting.

**Fix**: Change the image rendering approach based on alignment:
- For `center`: use `margin:0 auto` on the block-level image
- For `right`: use `margin-left:auto` 
- For `left`: keep default (no margin change)

Alternatively, change `display:block` to `display:inline-block` so `text-align` works. This is simpler and matches the editor (which uses `inline-block` class on line 217).

**File**: `renderBlocksToHtml.ts`, line 39 — change `display:block` to `display:inline-block` on the `<img>` tag.

### 2. Social Media Icons use emoji placeholders

The editor uses a `SOCIAL_PLATFORMS` map (line 170) with emojis (`📘`, `📷`, `💼`, `🐦`, `▶️`, `🎵`). The preview (line 129-134) just shows a text placeholder saying "Social media icons auto-populated from profile" -- it renders no actual icons at all.

**Fix for preview** (`renderBlocksToHtml.ts`, `renderSocialIcons`): Replace the placeholder text with actual rendered social icon links. Use simple branded text-based links with platform-specific colors or a universal style since email clients don't support SVG icons reliably. The standard approach for email is to use small hosted PNG/SVG icon images or styled text links.

Since we don't have hosted icon images, the pragmatic email-safe approach is to render styled text links with the platform name and a simple visual indicator (colored circle or branded color background).

**Fix for editor** (`BlockRenderer.tsx`, line 170 and 310-330): Replace the emoji map with actual Lucide icons where possible. Lucide has icons for several platforms: `Facebook`, `Instagram`, `Linkedin`, `Twitter`, `Youtube`. For TikTok and others, use a generic `Globe` or `Link` icon.

## Changes

### `renderBlocksToHtml.ts` — Image alignment fix (line 39)
Change the `<img>` style from `display:block` to `display:inline-block` so that the parent's `text-align` property takes effect.

### `renderBlocksToHtml.ts` — Social icons (lines 129-134)
Replace the placeholder with actual rendered links. For each link in `props.links`, render an `<a>` tag with the platform name, styled as a small pill/badge with platform-specific background colors:
- Facebook: `#1877F2`
- Instagram: `#E4405F`
- LinkedIn: `#0A66C2`
- Twitter/X: `#000000`
- YouTube: `#FF0000`
- TikTok: `#000000`
- Default: `#6b7280`

If no links are configured, show a subtle placeholder message.

### `BlockRenderer.tsx` — Social icons (lines 170, 310-330)
Replace the `SOCIAL_PLATFORMS` emoji map with Lucide icon components. Import `Facebook`, `Instagram`, `Linkedin`, `Twitter`, `Youtube`, `Globe` from `lucide-react`. Render each platform link with its corresponding icon instead of an emoji. Keep the existing layout structure but swap the emoji `<span>` for the icon component.

## Files to modify

| File | Changes |
|------|---------|
| `renderBlocksToHtml.ts` | Fix image `display:inline-block`; replace social icons placeholder with actual styled links |
| `BlockRenderer.tsx` | Replace emoji map with Lucide icons for social platforms |

