

# Update Newsletter Footer Copy

Simple text change across 4 files (5 locations). Change "database" to "sphere" in the footer message.

## Changes

### 1. `supabase/functions/newsletter-template-send/index.ts` (line 291)
**Primary sending engine** -- change "valued contact in our database" → "valued contact in our sphere"

### 2. `supabase/functions/newsletter-send/index.ts` (lines 86 and 255)
**Legacy send function** -- same text change in both the plain-text footer and HTML footer

### 3. `supabase/functions/newsletter-monthly/index.ts` (line 454)
**Monthly newsletter function** -- same text change

### 4. `src/components/newsletter/NewsletterPreview.tsx` (line 174)
**Client-side preview** -- same text change so the preview matches what recipients actually receive

## Note on "Agent's Name" and "Agent's Address"

These are already dynamic. The copyright line already renders `© 2026 {agentName}. All rights reserved.` using each agent's actual name from their profile. The address line uses `companyAddress` (from the `COMPANY_PHYSICAL_ADDRESS` env var or `agent.office_address`). No changes needed for those -- they already personalize per agent.

