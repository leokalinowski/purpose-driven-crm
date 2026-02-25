

# Remove Market Data Block

The user wants to scrap the Market Data block entirely because it's unreliable. This is a straightforward removal across all builder files.

## Changes

### 1. `src/components/newsletter/builder/types.ts`
- Remove `'market_data'` from the `BlockType` union
- Remove the `MarketDataProps` interface
- Remove `MarketDataProps` from the `BlockProps` union
- Remove the `market_data` entry from `BLOCK_DEFAULTS`

### 2. `src/components/newsletter/builder/BlockPalette.tsx`
- Remove the `market_data` entry from `PALETTE_ITEMS`
- Remove the `BarChart3` icon import

### 3. `src/components/newsletter/builder/BlockSettings.tsx`
- Remove the `market_data` case (header text input, style selector, metric checkboxes)

### 4. `src/components/newsletter/builder/BlockRenderer.tsx`
- Remove the `market_data` case from the canvas preview renderer

### 5. `src/components/newsletter/builder/renderBlocksToHtml.ts`
- Remove the `market_data` case from the HTML renderer

No database changes needed. The block type simply stops being available. Any existing templates that contain a `market_data` block will render as an unknown block (harmless fallback).

