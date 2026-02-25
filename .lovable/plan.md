

# Autosave + Improved Font Selectors

## Problem 1: No Autosave

Currently, templates only save when the user clicks "Save." If they navigate away or the browser closes, all work is lost. The builder needs debounced autosave that triggers whenever `blocks`, `globalStyles`, or `templateName` change.

## Problem 2: Font Selectors Are Basic

The heading block has a raw text input for `fontFamily` (line 48 of BlockSettings) -- users must type CSS font-family strings manually. The global styles editor has a dropdown but only 5 fonts (Georgia, Arial, Helvetica, Times New Roman, Verdana). The text block has no font selector at all.

## Implementation

### 1. Autosave in `NewsletterBuilder.tsx`

Add a `useEffect` that watches `blocks`, `globalStyles`, and `templateName`. After changes, debounce for 2 seconds, then call `handleSave`. Show a small status indicator in the toolbar ("Saved", "Saving...", "Unsaved changes").

- Use a `useRef` for the debounce timer
- Skip the first render (don't save on load)
- Track a `hasLoadedTemplate` flag to avoid saving the initial empty state over an existing template
- For brand-new templates (no `currentId`), auto-create on first edit so future autosaves have an ID to update

### 2. Improved Font Selectors

Create a shared `FONT_OPTIONS` constant with email-safe fonts, each showing a preview in its own typeface:

```
Georgia, serif
Arial, sans-serif
Helvetica, sans-serif
Times New Roman, serif
Verdana, sans-serif
Trebuchet MS, sans-serif
Courier New, monospace
Palatino Linotype, serif
Garamond, serif
Tahoma, sans-serif
Lucida Sans, sans-serif
Book Antiqua, serif
```

Create a reusable `FontFamilySelect` component that renders each option with `style={{ fontFamily }}` so users see a visual preview.

Apply this component to:
- **Heading block** settings (replace the raw text input on line 48)
- **Text block** settings (add a new font family selector -- currently missing)
- **Global styles** editor (replace the existing 5-option dropdown on lines 399-408)

### 3. Add `fontFamily` to Text Block

Update `types.ts` to add `fontFamily` to `TextProps` and its default in `BLOCK_DEFAULTS.text`. Update `BlockRenderer.tsx` and `renderBlocksToHtml.ts` to respect the text block's font family.

## Files to Modify

| File | Change |
|---|---|
| `src/components/newsletter/builder/NewsletterBuilder.tsx` | Add debounced autosave with status indicator |
| `src/components/newsletter/builder/BlockSettings.tsx` | Create `FontFamilySelect` component, replace heading font input, add font to text block, update global styles font dropdown |
| `src/components/newsletter/builder/types.ts` | Add `fontFamily` to `TextProps` and `BLOCK_DEFAULTS.text` |
| `src/components/newsletter/builder/BlockRenderer.tsx` | Apply text block `fontFamily` in canvas preview |
| `src/components/newsletter/builder/renderBlocksToHtml.ts` | Apply text block `fontFamily` in email HTML output |

