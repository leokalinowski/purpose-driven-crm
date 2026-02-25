

# Fix Global Font & Background Color in Editor

## Problem

Two issues with the editor canvas not reflecting global style changes:

1. **Font doesn't change**: `BlockRenderer.tsx` still applies `fontFamily: block.props.fontFamily` on heading (line 200) and text (line 210) blocks, and listings hardcode `fontFamily: 'Georgia, serif'` (lines 254, 261, 273). Even though the previous plan removed `fontFamily` from types/defaults, the inline style references remain in the renderer. Additionally, the canvas container never sets the global font, so there's nothing to inherit.

2. **Background color doesn't change**: The canvas wrapper in `NewsletterBuilder.tsx` (line 228) uses `className="bg-card"` which is a fixed Tailwind class. The `globalStyles.backgroundColor` is never applied to the editor canvas -- only the preview iframe uses it via `renderBlocksToHtml`.

## Changes

### `NewsletterBuilder.tsx`
- Pass `globalStyles` to `BuilderCanvas` component
- Apply `globalStyles.backgroundColor` and `globalStyles.fontFamily` as inline styles on the canvas wrapper `<div>` (line 228), replacing the static `bg-card` class

### `BuilderCanvas.tsx`
- Accept `globalStyles` prop
- Apply `style={{ backgroundColor: globalStyles.backgroundColor, fontFamily: globalStyles.fontFamily }}` on the outer canvas container so all child blocks inherit the font

### `BlockRenderer.tsx`
- **Heading** (line 200): Remove `fontFamily: block.props.fontFamily` from the inline style
- **Text** (line 210): Remove `fontFamily: block.props.fontFamily` from the inline style
- **Listings** (lines 254, 261, 273): Remove `style={{ fontFamily: 'Georgia, serif' }}` from the three listing text elements -- let them inherit from the canvas

These are small, surgical edits across 3 files.

