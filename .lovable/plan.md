

# Newsletter Builder Improvements Plan

## Audit Findings

After reviewing every file in the builder system, here are all issues found:

### Issues to Fix

1. **Image block: no file upload** -- The image block only accepts a URL typed into the settings panel. There is no file picker or upload capability. Users must paste a URL manually.

2. **Newsletter Builder is a standalone route, not inside the Newsletter tab** -- It lives at `/newsletter-builder` as a full-screen standalone page (no Layout wrapper, no sidebar). The user wants it embedded within the `/newsletter` page as a tab.

3. **Sidebar has a separate "Newsletter Builder" link** -- Needs to be removed since it will be merged into the Newsletter tab.

4. **Columns block is a placeholder** -- Renders "2-column layout (coming in Phase 2)" with no actual functionality. Cannot add child blocks into columns.

5. **Text block editing is fragile** -- Uses `contentEditable` with `dangerouslySetInnerHTML` and captures content on blur. This can lose cursor position, strip formatting, and conflict between the canvas inline editing and the settings panel textarea (both edit the same `html` prop).

6. **No global styles editor** -- `globalStyles` state exists but there is no UI to change background color, content width, font family, or body color.

7. **Template list/management missing** -- No way to see saved templates, switch between them, create new, or delete old ones from the UI. The builder only works if you navigate directly with a template ID.

8. **Back button uses `navigate(-1)`** -- Unreliable; if the user landed directly on the builder, it navigates out of the app.

9. **Listings block missing from palette** -- The `listings` type exists in types but is not in the `BlockPalette` PALETTE_ITEMS array.

10. **Social Icons block missing from palette** -- Same issue -- defined in types but not in the palette.

## Implementation Plan

### 1. Move Builder into Newsletter Page as a Tab

- Modify `src/pages/Newsletter.tsx` to add a "Builder" tab alongside the existing analytics view
- The builder tab will show a template list (manage templates) and open the builder inline
- Remove `Newsletter Builder` from `AppSidebar.tsx` navigation
- Keep the `/newsletter-builder/:templateId?` route as a standalone full-screen editing route (linked from the tab), but the entry point moves to the Newsletter page
- Update back button to navigate to `/newsletter`

### 2. Add Image Upload via Supabase Storage

- Create a `newsletter-assets` storage bucket (public, so images can be used in emails)
- RLS: Authenticated users can upload to their own folder (`{user_id}/`)
- In `BlockSettings.tsx` for the image block, add an "Upload Image" button alongside the URL input
- Upload to `newsletter-assets/{user_id}/{filename}`, get the public URL, set it as `src`
- Show a small preview thumbnail after upload

### 3. Template List & Management UI

- Create `src/components/newsletter/builder/TemplateList.tsx`
- Shows saved templates as cards with name, last updated, and thumbnail
- Actions: Edit (opens builder), Duplicate, Delete
- "Create New Template" button
- This component renders inside the Newsletter page "Builder" tab

### 4. Global Styles Editor

- Add a "Global Styles" section in the right settings panel when no block is selected
- Controls for: background color, content width (500-700px slider), font family (dropdown), body text color
- Pass `globalStyles` and `setGlobalStyles` down to the settings panel

### 5. Add Missing Blocks to Palette

- Add `listings` and `social_icons` to the `PALETTE_ITEMS` array in `BlockPalette.tsx`
- They already have types, defaults, settings, and renderers

### 6. Fix Text Block Editing

- Remove `contentEditable` from the canvas text block -- keep it display-only on the canvas
- All text editing happens in the settings panel textarea (single source of truth)
- This eliminates the conflict between inline editing and panel editing

## Files to Create

| File | Purpose |
|---|---|
| `src/components/newsletter/builder/TemplateList.tsx` | Template management grid |
| SQL migration | Create `newsletter-assets` storage bucket + RLS |

## Files to Modify

| File | Change |
|---|---|
| `src/pages/Newsletter.tsx` | Add "Builder" tab with template list |
| `src/components/layout/AppSidebar.tsx` | Remove "Newsletter Builder" from nav |
| `src/components/newsletter/builder/BlockSettings.tsx` | Add image upload button, add global styles when no block selected |
| `src/components/newsletter/builder/BlockPalette.tsx` | Add listings + social_icons to palette |
| `src/components/newsletter/builder/BlockRenderer.tsx` | Remove contentEditable from text/heading, add listings + social_icons previews |
| `src/components/newsletter/builder/NewsletterBuilder.tsx` | Pass globalStyles to settings panel, fix back button to `/newsletter` |
| `src/components/newsletter/builder/renderBlocksToHtml.ts` | Add social_icons + listings HTML renderers |

