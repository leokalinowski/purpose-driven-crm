

# Fix: Admin Newsletter Page Crash — `r.map is not a function`

## Root Cause

The `TemplateThumbnail` component on the Admin Newsletter page calls `renderBlocksToHtml()` for every template to generate iframe previews. Inside `renderSocialIcons()`, the code does:
```js
const links = props.links || [];
links.map(...)
```

If any template in the database has a `social_icons` block where `links` is stored as a non-array truthy value (e.g., a JSON object, string, or `null` that gets deserialized oddly), the `|| []` fallback doesn't trigger and `.map()` crashes. This crashes the entire page via the ErrorBoundary.

The same vulnerability exists in `BlockRenderer.tsx` line 343 and `renderBlocksToHtml.ts` line 145.

## Fix

### 1. `src/components/newsletter/builder/renderBlocksToHtml.ts`
- Line 145: Change `const links = props.links || []` to `const links = Array.isArray(props.links) ? props.links : []`
- Line 94 (listings): Same fix for `listings` array: `Array.isArray(props.listings) ? props.listings : []`

### 2. `src/components/newsletter/builder/BlockRenderer.tsx`
- Line 343: Change `const links = block.props.links || []` to `const links = Array.isArray(block.props.links) ? block.props.links : []`

### 3. `src/components/newsletter/builder/renderBlocksToHtml.ts`
- Wrap the entire `renderBlock` function body in a try/catch that returns an empty string on error, so one bad block doesn't crash the whole page

These are 3 small surgical changes — no structural changes needed.

