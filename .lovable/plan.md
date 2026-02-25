

# Fix Multi-Column Editing + Block Audit + Template Preview Thumbnails

## 1. Multi-Column Child Blocks Are Not Editable

**Root cause**: In `BlockRenderer.tsx`, the `columns` case renders child blocks via `ColumnDropZone`, which only shows static `BlockPreview` divs (lines 94-98). There is no mechanism to select, edit, or delete child blocks. Clicking a child just triggers the parent columns block's `onSelect` due to `e.stopPropagation()` on line 40.

**Fix**: Refactor column child rendering to support selection and editing:

- Add `selectedChildId` and `onSelectChild` to the component's interface — but actually, the simpler approach is to make the selection system in `NewsletterBuilder` aware of nested blocks. Currently `selectedBlockId` is flat. We need to support selecting a child block inside a column.

**Approach**: Flatten the selection model. When a child block inside a column is clicked:
1. The `BlockRenderer` for the parent columns block receives an `onSelectChild` callback
2. Clicking a child block calls `onSelectChild(parentId, columnIndex, childId)`
3. `NewsletterBuilder` tracks `selectedChildPath: { parentId, colIndex, childIndex } | null`
4. When a child is selected, `BlockSettings` receives the child block and updates route through the parent's `children` array
5. Each child block in a column gets its own mini-toolbar (delete, duplicate, move up/down)

**Files to modify**:
- `BlockRenderer.tsx` — Add clickable child blocks with toolbars inside `ColumnDropZone`; pass selection callbacks
- `BuilderCanvas.tsx` — Track child selection; pass child update/delete/select callbacks; implement `updateChildBlock`, `deleteChildBlock` functions
- `NewsletterBuilder.tsx` — Extend selection state to support `selectedChildPath`; derive the selected block from either top-level or nested; route `handleUpdateBlockProps` to update nested children when a child is selected
- `BlockSettings.tsx` — No structural changes needed (it already receives a `block` and `onUpdate`)

## 2. Block Audit — Issues and Improvements Found

| Block | Issue | Fix |
|---|---|---|
| **Columns** | Children not editable (above) | Full fix above |
| **Image** | No max file size warning on upload | Add a check in `ImageUploadSetting` — warn if file > 2MB |
| **Button** | No validation on URL field | Add placeholder hint, no breaking issue |
| **Listings** | Scrape failures silently swallowed if `data.listing` is undefined | Add null check in `handleAddListing` |
| **HTML Raw** | `dangerouslySetInnerHTML` on raw user HTML in canvas could break layout | Wrap in a sandboxed container with `overflow:hidden` — already done |
| **Social Icons** | Platform select uses `p` as variable name shadowing the outer `p` (props) on line 244 of BlockSettings | Rename inner variable to `platform` to avoid shadowing |
| **Agent Bio** | Preview looks good, no issues | — |
| **Text** | `convertNewlines` fix already applied | — |

The social icons variable shadowing (line 244) is a minor bug that could cause issues. Will fix.

## 3. Template Preview Thumbnails on Newsletter Page

**Current state**: `TemplateList.tsx` line 119 shows `"4 blocks"` as a text description. The user wants a visual preview thumbnail instead.

**Approach**: Render a scaled-down iframe of the newsletter HTML directly in each template card. This avoids needing server-side screenshot generation.

- In `TemplateList.tsx`, import `renderBlocksToHtml` and generate the HTML for each template
- Replace the `"X blocks"` text with a small iframe (`srcDoc={html}`) scaled down using CSS `transform: scale(0.25)` with `pointer-events: none` inside a fixed-height container
- The iframe shows a miniature visual preview of the actual newsletter content

**Files to modify**:
- `TemplateList.tsx` — Add preview iframe per template card, remove block count text

## Files Summary

| File | Changes |
|---|---|
| `NewsletterBuilder.tsx` | Add `selectedChildPath` state; derive selected block from nested children; route updates to children |
| `BuilderCanvas.tsx` | Add child selection/update/delete callbacks; pass to `BlockRenderer` |
| `BlockRenderer.tsx` | Make column children interactive with click-to-select, delete buttons, and mini-toolbars |
| `BlockSettings.tsx` | Fix variable shadowing in social icons (line 244) |
| `TemplateList.tsx` | Replace "X blocks" with scaled iframe preview thumbnail |

## Technical Detail: Child Block Selection Model

```text
State shape:
  selectedBlockId: string | null          // top-level block
  selectedChildPath: {                    // nested block (inside columns)
    parentId: string
    colIndex: number
    childId: string
  } | null

Selection logic:
  - Click top-level block → set selectedBlockId, clear selectedChildPath
  - Click child block inside column → set selectedChildPath, clear selectedBlockId
  - Click canvas background → clear both

Deriving selected block for settings panel:
  if (selectedChildPath) {
    const parent = blocks.find(b => b.id === selectedChildPath.parentId);
    const child = parent?.children?.[selectedChildPath.colIndex]
      ?.find(c => c.id === selectedChildPath.childId);
    return child;
  }
  return blocks.find(b => b.id === selectedBlockId);

Updating child props:
  setBlocks(blocks.map(b => {
    if (b.id !== parentId) return b;
    const newChildren = b.children.map((col, i) =>
      i !== colIndex ? col : col.map(c =>
        c.id !== childId ? c : { ...c, props: { ...c.props, ...newProps } }
      )
    );
    return { ...b, children: newChildren };
  }));
```

## Technical Detail: Template Preview Thumbnail

```text
Per template card:
┌─────────────────────────┐
│ Template Name           │
│ Updated Jan 5, 2026     │
│ ┌─────────────────────┐ │
│ │  Scaled iframe      │ │
│ │  (pointer-events:   │ │
│ │   none, h-32,       │ │
│ │   transform:        │ │
│ │   scale(0.3))       │ │
│ └─────────────────────┘ │
│ [Edit] [Copy] [Delete]  │
└─────────────────────────┘
```

