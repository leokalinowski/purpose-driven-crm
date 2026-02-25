

# Fix: Admin-Created Templates Being Saved to Admin's Account

## Root Cause

The `NewsletterBuilder` component calls `useNewsletterTemplates()` on line 30 **without any agentId argument**. This means the hook defaults to `user.id` (the logged-in admin) and filters templates with `.eq('agent_id', user.id)`.

When an admin opens `/newsletter-builder/{id}` for an agent's template, the query returns **zero results** because it only fetches the admin's own templates. The `useEffect` on line 86 tries to find the template in `templates` but fails (`templates.find(t => t.id === templateId)` returns `undefined`). So:

1. `templateAgentId` is never set (stays `undefined`)
2. On save, `agent_id: templateAgentId || user.id` resolves to `user.id` (the admin)
3. The template gets reassigned to the admin's account

Additionally, the brand colors and profile data fetched in lines 50-80 always use `user.id` (the admin), not the template's agent. So previews show the admin's branding instead of the agent's.

## Fix

### 1. `NewsletterBuilder.tsx` -- Fetch the template directly instead of relying on filtered list

When a `templateId` URL param exists, fetch that specific template directly from Supabase (admins have RLS access to all templates) instead of relying on the `useNewsletterTemplates` hook which filters by agent. This guarantees the template is found regardless of ownership.

- Add a direct `supabase.from('newsletter_templates').select('*').eq('id', templateId).single()` query when `templateId` is present
- Set `templateAgentId` from the fetched template's `agent_id`
- Keep `useNewsletterTemplates(templateAgentId)` for the save mutation only, passing the correct agent ID

### 2. `NewsletterBuilder.tsx` -- Load brand colors and profile for the template's agent

Change the brand colors/profile fetch (lines 50-80) to use `templateAgentId` instead of `user.id` when available. This ensures the preview shows the correct agent's branding.

### 3. `useNewsletterTemplates.ts` -- No changes needed

The hook's filtering logic is correct for normal agent use. The fix is in the Builder loading the template directly.

## Files to Change

| File | Changes |
|------|---------|
| `src/components/newsletter/builder/NewsletterBuilder.tsx` | Replace template loading from hook's filtered list with a direct Supabase query by `templateId`; use `templateAgentId` for brand colors and profile fetching |

