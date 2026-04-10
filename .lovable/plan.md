
Goal: fix the public RSVP page so it reliably loads on `hub.realestateonpurpose.com`, stays public for non-users, and keeps dynamic OG previews.

What I verified
- The public route itself is not auth-gated in app code:
  - `src/App.tsx` exposes `/event/:slug` publicly
  - `src/pages/EventPublicPage.tsx` does not redirect to login
  - `src/hooks/useRSVP.ts` and `src/hooks/useRSVPQuestions.ts` use public reads/RPCs for the RSVP flow
- I tested the current hub event page and it is still broken:
  - URL stayed on `https://hub.realestateonpurpose.com/event/purge-perk`
  - browser hit the boot timeout
  - the event document returned 200, but the JS/CSS requests failed
- This does not currently look like an auth/RLS lockout. The app is failing before React mounts.

Root cause
- The current Vercel function for humans fetches `https://purpose-driven-crm.lovable.app/event/:slug` and injects:
  - `<base href="https://purpose-driven-crm.lovable.app/">`
- That forces asset loading from the Lovable origin instead of the hub proxy path.
- In the browser test, the event page then requested hashed assets directly from `purpose-driven-crm.lovable.app` and those requests failed, which explains the permanent loading screen.
- So the weak point is the human HTML delivery strategy in `api/og-event-meta.ts`, not the public RSVP route permissions.

Ultimate fix
1. Replace the human-page proxy strategy
- In `api/og-event-meta.ts`, stop fetching `/${event-slug}` from the published app for human users.
- Instead fetch the current SPA shell from the app root (`https://purpose-driven-crm.lovable.app/` or `/index.html`), not a deep event route.
- Return that shell as HTML for humans.

2. Remove the `<base>` injection for humans
- Do not force assets to load from `purpose-driven-crm.lovable.app`.
- Let relative asset paths stay relative so the browser requests:
  - `https://hub.realestateonpurpose.com/assets/...`
- Your existing `vercel.json` catch-all already proxies those asset requests to the published app, and that path is what was working on the hub homepage.

3. Keep crawler OG handling separate
- Keep `/event/:slug -> /api/og-event-meta?slug=:slug`
- Keep crawler detection and dynamic OG tags in `api/og-event-meta.ts`
- Crawlers should still get branded metadata for `hub.realestateonpurpose.com`
- Humans should get the plain SPA shell, not crawler HTML and not origin-forced assets

4. Make human responses uncached
- Set human-side HTML cache to `no-store` or equivalent
- This avoids stale HTML pointing at stale hashed assets after new publishes

5. Keep the page fully public
- Do not add any auth checks to `/event/:slug`
- Preserve the public `events` lookup and public RSVP RPC flow
- If needed, only harden error handling, not access control

6. Fix one public RSVP bug while touching the flow
- In `src/components/events/rsvp/RSVPForm.tsx`, the form currently disables submit when at capacity:
  - `disabled={loading || isAtCapacity}`
- That contradicts the “Join Waitlist” behavior
- Change it so waitlist submissions remain possible when capacity is reached

Files to update
- `api/og-event-meta.ts`
  - human branch should serve current SPA shell from app root
  - remove `<base href="https://purpose-driven-crm.lovable.app/">`
  - keep crawler OG HTML
  - add strict no-store for human HTML
- `vercel.json`
  - likely keep as-is unless a small rewrite adjustment is needed after implementation
- `src/components/events/rsvp/RSVPForm.tsx`
  - allow waitlist submission instead of disabling the button at capacity
- optionally `src/hooks/useRSVP.ts`
  - only minor cleanup if we want clearer public error messages, not for the core fix

Verification I will do after implementation
1. Open Pam’s public event on:
- `https://hub.realestateonpurpose.com/event/...`
2. Confirm:
- URL remains on `hub.realestateonpurpose.com`
- no boot timeout
- JS/CSS load successfully
- React mounts and the event content renders
- the page is still accessible while logged out
3. Confirm OG behavior:
- crawler response still includes correct event title/image/meta
4. Confirm RSVP behavior:
- form renders
- waitlist behavior works if event is full
- if you want me to test a live RSVP submission too, I should use a clearly marked test email so we don’t pollute real attendee data

Expected result
- public RSVP pages load again on the branded domain
- they stay accessible to normal non-user visitors
- dynamic preview images remain intact
- no more raw HTML / no more endless loading state
