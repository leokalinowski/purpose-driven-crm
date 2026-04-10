

## Fix: Update OG Event Meta to Use Custom Domain

### Problem
The `og-event-meta` edge function and `vercel.json` reference `purpose-driven-crm.lovable.app` instead of `hub.realestateonpurpose.com`. All other edge functions (event invitations, email scheduler, coaching reminders, etc.) correctly use the custom domain.

### Changes

**File: `supabase/functions/og-event-meta/index.ts`** (lines 9-10)
- Change `DEFAULT_OG_IMAGE` from `https://purpose-driven-crm.lovable.app/og-image.png` to `https://hub.realestateonpurpose.com/og-image.png`
- Change `SITE_URL` from `https://purpose-driven-crm.lovable.app` to `https://hub.realestateonpurpose.com`

**File: `vercel.json`**
- Update the rewrite destination comment/context if needed (the rewrite itself points to Supabase, so no functional change there)

Then redeploy the edge function.

### Technical Details
- 1 file modified, 2 lines changed
- Edge function redeployed
- All OG URLs (og:url, meta refresh redirect, fallback image) will point to the custom domain

