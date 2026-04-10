

## Fix: RSVP Pages Redirect Loop (ERR_TOO_MANY_REDIRECTS)

### Root Cause

The `og-event-meta` edge function has two jobs:
1. **Crawlers** (Facebook, Twitter, etc.) get HTML with OG meta tags — these should reference `hub.realestateonpurpose.com`
2. **Regular browsers** get a 302 redirect to the actual SPA page

The problem: `vercel.json` rewrites ALL `/event/:slug` requests to the edge function. When the edge function redirects non-crawlers back to `hub.realestateonpurpose.com/event/:slug`, Vercel intercepts it again and sends it back to the edge function — creating an infinite redirect loop.

Previously `SITE_URL` was `purpose-driven-crm.lovable.app` (the direct Lovable URL), so non-crawler redirects bypassed Vercel entirely. Changing it to `hub.realestateonpurpose.com` broke this.

### Fix

**File: `supabase/functions/og-event-meta/index.ts`**

Split into two constants:
- `OG_SITE_URL = "https://hub.realestateonpurpose.com"` — used in OG meta tags (og:url, meta refresh) so link previews show the correct branded URL
- `REDIRECT_URL = "https://purpose-driven-crm.lovable.app"` — used for 302 non-crawler redirects to bypass Vercel's rewrite and land directly on the SPA

Changes:
- Line 10: Add `REDIRECT_URL` constant
- Lines 33-36: Non-crawler redirect uses `REDIRECT_URL` instead of `SITE_URL`
- Lines 51-52: Fallback redirect uses `REDIRECT_URL`
- Lines 67, 77, 83: OG meta tags and meta-refresh keep using `OG_SITE_URL`

Then redeploy the edge function.

### Result
- Regular users visiting `hub.realestateonpurpose.com/event/slug` → Vercel rewrites to edge function → 302 to `purpose-driven-crm.lovable.app/event/slug` → SPA loads correctly
- Crawlers → get OG HTML with `hub.realestateonpurpose.com` URLs → link previews show correct domain
- No more redirect loop

### Files Modified
- `supabase/functions/og-event-meta/index.ts` — split SITE_URL into OG vs redirect URLs
- Edge function redeployed

