

## Dynamic Open Graph Images for Event RSVP Pages

### Problem
When sharing an event RSVP link (e.g. `/event/pams-open-house`), messaging apps and social platforms fetch the static `index.html` and see the generic CRM OG image — not the event's header banner. Link crawlers don't execute JavaScript, so the SPA can't dynamically set meta tags.

### Solution
Create a Supabase Edge Function that acts as a proxy for event public pages. When a crawler requests an event URL, it returns HTML with the correct OG meta tags (title, description, image). For regular browsers, it redirects to the SPA.

### How It Works

```text
User shares: https://purpose-driven-crm.lovable.app/event/pams-open-house
                              │
                    Crawler hits URL
                              │
              ┌───────────────┴───────────────┐
              │  Vercel rewrite rule sends     │
              │  /event/:slug to edge function │
              └───────────────┬───────────────┘
                              │
              ┌───────────────┴───────────────┐
              │  Edge function detects crawler │
              │  via User-Agent                │
              │  → Returns minimal HTML with   │
              │    correct OG tags + redirect  │
              │                                │
              │  Regular browser?              │
              │  → Serves index.html as normal │
              └───────────────────────────────┘
```

### Changes

1. **New Edge Function: `supabase/functions/og-event-meta/index.ts`**
   - Accepts a `slug` query parameter
   - Fetches event data from the `events` table (title, description, header_image_url, event_date, location)
   - If request is from a crawler (detected by User-Agent: facebookexternalhit, Twitterbot, iMessage, WhatsApp, Slackbot, LinkedInBot, etc.), returns a minimal HTML page with:
     - `og:title` = event title
     - `og:description` = event date + location
     - `og:image` = header_image_url
     - `twitter:card` = summary_large_image
     - A meta refresh redirect to the real SPA page
   - If request is from a regular browser, returns a 302 redirect to the SPA

2. **Update `vercel.json`** — Add a rewrite rule so `/event/:slug` hits the edge function first:
   ```json
   { "source": "/event/:slug", "destination": "https://<supabase-url>/functions/v1/og-event-meta?slug=:slug" }
   ```
   This rewrite is transparent — browsers get redirected to the SPA, crawlers get the OG tags.

3. **Deploy the edge function**

### Technical Details
- No changes to `EventPublicPage.tsx` or the SPA routing
- The edge function only queries the `events` table (public slug + is_published check)
- Crawler detection uses standard User-Agent strings
- Fallback: if no header image exists, falls back to the current default OG image
- 2 files changed: 1 new edge function, 1 `vercel.json` update

