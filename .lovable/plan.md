

## Add Dynamic Meta Tags for All Pages via Vercel Function

### Approach

Extend the existing working pattern: the Vercel serverless function at `api/og-event-meta.ts` already handles `/event/:slug` with crawler detection. We'll create a **general-purpose** Vercel function (`api/og-meta.ts`) that handles all routes, keeping the event-specific one intact.

### How It Works

**For crawlers**: The function inspects the URL path and generates appropriate OG tags based on the page type:

| Route | Title | Description | Image |
|-------|-------|-------------|-------|
| `/event/:slug` | Event title | Date + Location | Event banner (`header_image_url`) |
| `/` | Real Estate on Purpose - CRM | Professional Real Estate CRM... | Default OG image |
| `/pricing` | Pricing - Real Estate on Purpose | Plans and pricing... | Default OG image |
| `/newsletter` | Newsletter - Real Estate on Purpose | ... | Default OG image |
| `/pipeline` | Pipeline - Real Estate on Purpose | ... | Default OG image |
| Other pages | Page Name - Real Estate on Purpose | Static description | Default OG image |

Only `/event/:slug` needs a database lookup. All other pages use a static mapping — simple, fast, and cannot break.

**For humans**: Serve the SPA shell exactly as today (fetch root `index.html`, return with `text/html`). No change to human delivery.

### Implementation

**1. Create `api/og-meta.ts`** — A new general-purpose Vercel function

- Accepts `path` query param (the full URL path like `/event/purge-perk` or `/pricing`)
- Crawler detection same as existing function
- For humans: fetch and return the SPA shell (same logic as current `og-event-meta.ts`)
- For crawlers: match the path against known routes and return appropriate OG HTML
  - If path matches `/event/:slug`, query Supabase for event data (reuse existing logic)
  - If path matches a known static page, use the static title/description
  - Fallback: generic site-level OG tags

**2. Update `vercel.json`** — Route all traffic through the new function

```json
{
  "rewrites": [
    {
      "source": "/event/:slug",
      "destination": "/api/og-meta?path=/event/:slug"
    },
    {
      "source": "/pricing",
      "destination": "/api/og-meta?path=/pricing"
    },
    {
      "source": "/newsletter",
      "destination": "/api/og-meta?path=/newsletter"
    },
    {
      "source": "/pipeline",
      "destination": "/api/og-meta?path=/pipeline"
    },
    {
      "source": "/coaching",
      "destination": "/api/og-meta?path=/coaching"
    },
    {
      "source": "/resources",
      "destination": "/api/og-meta?path=/resources"
    },
    {
      "source": "/support",
      "destination": "/api/og-meta?path=/support"
    },
    {
      "source": "/(.*)",
      "destination": "https://purpose-driven-crm.lovable.app/$1"
    }
  ]
}
```

The catch-all at the bottom still proxies assets and any unmatched routes to the Lovable origin.

**3. Keep `api/og-event-meta.ts`** — No changes, it can stay as a backup. The new function replaces its role.

### Safety measures

- Human delivery is identical to the working solution (fetch SPA root, serve as HTML, `no-store` cache)
- Static pages don't query the database at all — zero risk of breaking
- Only `/event/:slug` hits Supabase, using the same proven query
- If anything fails, fallback to generic OG tags + SPA shell

### Files
- `api/og-meta.ts` — new general-purpose OG + proxy function
- `vercel.json` — add rewrite rules for key pages
- `api/og-event-meta.ts` — keep as-is (no changes)

### After implementation
- Test Pam's event page to confirm it still loads
- Test a static page like `/pricing` with a crawler user-agent to verify OG tags
- Test human access to confirm SPA still hydrates

