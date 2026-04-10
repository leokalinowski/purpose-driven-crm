
Fix the RSVP loading regression by correcting the custom-domain delivery path, not the RSVP page itself.

What I found
- The current `og-event-meta` function is proxying human traffic by fetching HTML from `https://purpose-driven-crm.lovable.app/event/:slug` and returning it on `hub.realestateonpurpose.com`.
- That proxied HTML depends on JS/CSS assets like `/assets/...`.
- `vercel.json` currently rewrites every non-event path to `/`, which means requests for `/assets/...` on `hub.realestateonpurpose.com` are getting HTML instead of the real JS bundle.
- Result: the public event page shows the boot loader and never hydrates.
- Separately, the public RSVP page code has a weaker error path: `getEventBySlug()` uses `.single()`, so missing/bad slugs surface as the ugly PostgREST message `Cannot coerce the result to a single JSON object`.

Implementation plan
1. Fix the domain rewrite layer
- Update `vercel.json` so non-event requests proxy through to the real published app instead of rewriting to `/`.
- Keep the first `/event/:slug` rewrite to `og-event-meta`.
- Change the catch-all so `/assets/*`, route JS/CSS, and other SPA paths load from `https://purpose-driven-crm.lovable.app/:path*`.

2. Keep custom-domain event previews working
- Leave the `og-event-meta` function on the custom domain.
- Keep crawler behavior serving branded OG tags with `hub.realestateonpurpose.com`.
- Keep human behavior on the custom domain, but now it will work because the required app assets will resolve correctly through the updated rewrite.

3. Harden the RSVP page itself
- Update `src/hooks/useRSVP.ts` so `getEventBySlug()` uses a safer fetch path (`maybeSingle` + explicit not-found handling) instead of exposing the raw coercion error.
- Preserve the friendly “Event not found” state for bad or unpublished slugs.

4. Verify the full flow
- Confirm Pam’s event opens on `hub.realestateonpurpose.com/event/...`
- Confirm JS/CSS asset requests on the hub domain return actual files, not HTML
- Confirm the RSVP form renders, submits, and confirmation still works
- Confirm shared links still use the event banner image in OG previews

Files to update
- `vercel.json`
- `src/hooks/useRSVP.ts`
- Possibly `supabase/functions/og-event-meta/index.ts` only if minor cleanup is needed after the rewrite fix

Expected result
- Event RSVP pages load again on `hub.realestateonpurpose.com`
- The URL stays on the branded domain
- OG preview banners still work
- Bad slugs show a clean “Event not found” message instead of the current database error
