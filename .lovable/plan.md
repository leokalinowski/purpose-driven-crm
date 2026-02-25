

# Agent Bio Layout Setting — What It Should Do & How to Fix

## Current State

The Agent Bio block has a `layout` prop with two options: **"Horizontal"** and **"Vertical"** (set in `BlockSettings.tsx`). The default is `'horizontal'`. However, neither the editor (`BlockRenderer.tsx`) nor the preview (`renderBlocksToHtml.ts`) reads this prop — both always render a vertically-centered, stacked layout. The setting does nothing.

## Intended Behavior

- **Vertical** (current default rendering): Headshot on top, text stacked below, everything centered — a column layout.
- **Horizontal**: Headshot/logo on the left side, text details on the right — a side-by-side row layout. This is a common pattern for email signature-style agent bios.

## Changes

### 1. `BlockRenderer.tsx` — Editor agent_bio (lines 289-313)

Add layout-aware rendering:
- **Vertical**: Keep current stacked/centered layout.
- **Horizontal**: Render a `flex flex-row` layout with the headshot placeholder on the left and the text fields on the right, left-aligned.

### 2. `renderBlocksToHtml.ts` — Preview agent_bio (lines 59-74)

Read `props.layout` and change the HTML structure:
- **Vertical** (`text-align:center`, single column — current behavior): No change needed.
- **Horizontal**: Wrap content in a two-column table (email-safe). Left cell: headshot/logo placeholders. Right cell: name, license, contact details, left-aligned. This uses `<table>` layout since CSS flexbox is unreliable in email clients.

### Files

| File | Change |
|------|--------|
| `BlockRenderer.tsx` | Conditionally render horizontal vs vertical layout for agent_bio |
| `renderBlocksToHtml.ts` | Conditionally render table-based horizontal layout vs centered vertical layout |

