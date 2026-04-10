

## Fix: RSVP Pages Show Raw HTML (Supabase Content-Type Restriction)

### Root Cause (Confirmed via Network Headers)

Supabase's gateway **forces** two headers on all edge function responses:
- `Content-Type: text/plain` (overrides our `text/html`)
- `Content-Security-Policy: default-src 'none'; sandbox`

This means the `og-event-meta` Supabase edge function **cannot serve renderable HTML to browsers**. The browser receives the HTML as plain text and displays the raw source code. No amount of header-setting in the edge function will fix this — it's a Supabase gateway restriction.

Crawlers (Facebook, Twitter) still work because they parse OG tags from the response body regardless of Content-Type.

### Solution: Move Human Traffic to a Vercel Serverless Function

Create a Vercel serverless function at `api/og-event-meta.ts` that replaces the Supabase edge function for browser traffic. Vercel serverless functions **do** respect the Content-Type you set.

### Implementation

**1. Create `api/og-event-meta.ts` (new Vercel serverless function)**

This function contains the same logic currently in the Supabase edge function:
- Detect crawlers via User-Agent
- **Crawlers**: Query Supabase REST API for event data, return HTML with dynamic OG meta tags (title, description, event banner image) and `Content-Type: text/html`
- **Humans**: Fetch the SPA's `index.html` from `purpose-driven-crm.lovable.app`, inject `<base href>` tag, return with `Content-Type: text/html`

**2. Update `vercel.json`**

Change the `/event/:slug` rewrite to point to the local API function instead of the Supabase edge function:

```text
Before:
  /event/:slug → https://cguoaokqwgqvzkqqezcq.supabase.co/functions/v1/og-event-meta?slug=:slug

After:
  /event/:slug → /api/og-event-meta?slug=:slug
  /(.*) → https://purpose-driven-crm.lovable.app/$1  (unchanged catch-all)
```

**3. Keep Supabase edge function as-is**

No changes needed — it can remain deployed for any direct API usage, but browser traffic will no longer go through it.

### What This Fixes
- HTML renders properly (correct `Content-Type: text/html`, no sandbox CSP)
- URL stays on `hub.realestateonpurpose.com` (proxy, not redirect)
- JS/CSS assets load via `<base>` tag pointing to Lovable origin
- Social media link previews continue to show event banner images
- Bad/missing slugs show clean "Event not found" error

### Files
- `api/og-event-meta.ts` — **new** Vercel serverless function
- `vercel.json` — update rewrite target

### Note
The `api/` directory is a Vercel convention for serverless functions. Since the project already uses `vercel.json` and is deployed to Vercel for the hub domain, this will work automatically — Vercel detects and deploys functions in `api/`.

