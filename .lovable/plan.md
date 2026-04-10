

## Fix: RSVP Pages Not Hydrating on Custom Domain

### Root Cause

The `og-event-meta` edge function proxies the SPA's HTML from `purpose-driven-crm.lovable.app` to serve it on `hub.realestateonpurpose.com`. The proxied HTML contains **relative asset references** like `/assets/index-HASH.js`. The browser resolves these against `hub.realestateonpurpose.com`, which sends them through Vercel's catch-all rewrite. But this chain is fragile — the assets either fail to load correctly or get served with wrong content types, so the app never hydrates past the bootloader.

### Fix: Add `<base>` Tag to Proxied HTML

Inject a `<base href="https://purpose-driven-crm.lovable.app/">` tag into the proxied HTML. This tells the browser to resolve ALL relative URLs (scripts, stylesheets, images) directly against the Lovable origin, bypassing Vercel's rewrite entirely for assets.

**File: `supabase/functions/og-event-meta/index.ts`**

In the non-crawler proxy block (line 43-44), after fetching the HTML, inject the `<base>` tag:

```typescript
let html = await spaRes.text();
// Rewrite relative asset URLs to load directly from origin
html = html.replace('<head>', '<head><base href="https://purpose-driven-crm.lovable.app/">');
```

This is a single-line fix. The browser will:
- Stay on `hub.realestateonpurpose.com` (URL doesn't change)
- Load all JS/CSS/images directly from `purpose-driven-crm.lovable.app`
- Hydrate the React app correctly

### Also

- Redeploy the `og-event-meta` edge function after the change
- Verify with curl that the proxied HTML contains the `<base>` tag

### Files Modified
- `supabase/functions/og-event-meta/index.ts` — inject `<base>` tag into proxied HTML

