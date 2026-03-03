

## Plan: Uploadable Images + Unified Branding References

### Issues Found

**1. No file upload for headshot/logos in Settings or AgentMarketingSettingsForm**
The Branding tab in `AgentMarketingSettingsForm` only has text URL inputs for headshot, colored logo, and white logo. Users cannot upload files -- they must paste URLs manually. The file upload functionality only exists in `AdminTeamManagement.tsx`.

**2. Two places still read branding from `profiles` instead of `agent_marketing_settings`**
- `src/hooks/useRSVP.ts` line 216: `getEventBySlug` fetches `primary_color, secondary_color, headshot_url, logo_colored_url, logo_white_url` from `profiles`
- `src/components/events/email/EmailManagement.tsx` line 105: email preview loads branding from `profiles`

These are the last two places in the frontend reading branding from `profiles`. Everything else (edge functions, EventForm, useEvents, NewsletterBuilder) already reads from `agent_marketing_settings`.

**3. `event-email-scheduler` edge function still falls back to `profiles` for images**
The `makeReplaceVars` function (line 81-83) uses `event.profiles?.headshot_url || event._marketingBranding?.headshot_url` -- profiles is checked first. Since the profiles JOIN (line 237) no longer selects branding columns, this works by accident (profiles fields are undefined, so it falls through to marketing settings). But the code is misleading and fragile.

**4. Storage: no DELETE policy for non-admin users**
Users can upload to `agent-assets` bucket but cannot delete/replace their own files. They need UPDATE and DELETE policies to manage their own images.

### Implementation

**1. Add file upload to `AgentMarketingSettingsForm` (Branding tab)**

Replace the three plain text inputs (headshot, colored logo, white logo) with upload components that:
- Show a file input + current image preview
- Upload to `agent-assets/{userId}/headshot.ext`, `agent-assets/{userId}/logo-colored.ext`, `agent-assets/{userId}/logo-white.ext`
- Include a delete/clear button
- Fall back to manual URL input

**2. Fix `useRSVP.ts` -- read branding from `agent_marketing_settings`**

In `getEventBySlug`, after fetching the event and profile (for name, contact info), also fetch branding from `agent_marketing_settings` and merge it into the returned data. Remove branding columns from the profiles query.

**3. Fix `EmailManagement.tsx` -- read branding from `agent_marketing_settings`**

In `loadPreviewData`, fetch branding from `agent_marketing_settings` instead of `profiles`. Keep profiles query for contact info only (name, email, phone, etc.).

**4. Clean up `event-email-scheduler` `makeReplaceVars`**

Change the fallback order so `_marketingBranding` is checked first (it's the source of truth), with profiles as fallback only for backward compat.

**5. Storage migration: add UPDATE + DELETE policies for `agent-assets`**

Add policies allowing authenticated users to update/delete their own files in the `agent-assets` bucket (where folder name matches their user ID).

### Files to Create/Modify

| File | Action |
|---|---|
| Migration | **Create** -- add UPDATE + DELETE storage policies for `agent-assets` |
| `src/components/admin/AgentMarketingSettingsForm.tsx` | **Modify** -- replace URL inputs with file upload + preview for headshot, logos |
| `src/hooks/useRSVP.ts` | **Modify** -- read branding from `agent_marketing_settings` instead of `profiles` |
| `src/components/events/email/EmailManagement.tsx` | **Modify** -- read branding from `agent_marketing_settings` instead of `profiles` |
| `supabase/functions/event-email-scheduler/index.ts` | **Modify** -- fix fallback order in `makeReplaceVars` |

