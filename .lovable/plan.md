

# Fix Body Text Color for Listings, Agent Bio & Other Blocks

## Problem

The previous fix only updated `heading` and `text` blocks. Several other blocks still hardcode their text colors in both the editor (`BlockRenderer.tsx` via Tailwind classes like `text-foreground`) and the preview (`renderBlocksToHtml.ts` via inline `color:#1a1a1a`). These ignore `globalStyles.bodyColor`.

## Approach

Remove explicit color assignments from **primary text elements** so they inherit the global body color. Keep muted/secondary colors (detail lines, metadata) as relative opacity instead of hardcoded grays, so they scale with the chosen body color.

## Changes

### `renderBlocksToHtml.ts` — Remove hardcoded colors on primary text

**Listings block** (`renderListings`):
- Line 89: `color:#1a1a1a` on "Featured Listings" `<h3>` → remove color (inherit)
- Line 99: `color:#1a1a1a` on price `<p>` → remove color (inherit)
- Line 100: `color:#4b5563` on address `<p>` → remove color (inherit)
- Line 101: `color:#6b7280` on city `<p>` → `opacity:0.7` instead
- Line 102: `color:#9ca3af` on bed/bath `<p>` → `opacity:0.5` instead
- Lines 115-118 (list view): same pattern as above

**Agent bio block** (`renderAgentBio`):
- Line 63: `color:#1a1a1a` on agent name → remove (inherit)
- Line 64: `color:#64748b` on license → `opacity:0.6` instead
- Line 65: `color:#374151` on brokerage → remove (inherit)
- Lines 66-68: `color:#374151` on phone/office phone/email → remove (inherit)
- Line 69: `color:#64748b` on office address → `opacity:0.6`
- Line 72: `color:#94a3b8` on equal housing → `opacity:0.5`

**Social icons** (line ~128): `color:#64748b` → remove

### `BlockRenderer.tsx` — Remove Tailwind color classes on primary text

**Listings** (lines 254-276):
- Line 254, 261: `text-foreground` on "Featured Listings" → remove class
- Line 273: `text-foreground` on price → remove class
- Lines 274-276: `text-muted-foreground` → change to `opacity-70` / `opacity-50` so they scale with the inherited body color

**Agent bio** (line 300):
- `text-center` keeps but any explicit color classes should be removed so the bio text inherits

These changes mean primary text always inherits `globalStyles.bodyColor`, while secondary/detail text uses opacity to appear lighter relative to whatever the body color is.

## Files

| File | What changes |
|------|-------------|
| `renderBlocksToHtml.ts` | Remove hardcoded `color:` from listings & agent_bio primary text; use `opacity` for secondary |
| `BlockRenderer.tsx` | Remove `text-foreground` / `text-muted-foreground` from listings & agent_bio; use `opacity-` utilities for secondary text |

