

# Plan: Admin Newsletter Template Management and Agent-Aware Sending

## Problems Identified

### 1. Admins cannot create templates for agents
The "New Template" action does not exist on the admin page. The `TemplateList` and `NewsletterBuilder` both hardcode `user.id` as `agent_id`, so any template an admin creates or edits gets assigned to the admin's own account, not the intended agent.

### 2. Admins cannot copy/duplicate/delete templates
`AdminNewsletterTemplates` only has Edit and Send buttons. No duplicate-to-agent or delete actions exist.

### 3. SendSchedulePanel sends as the logged-in user, not the template's agent
`SendSchedulePanel` hardcodes `user.id` for `agent_id` in all send calls (lines 57, 78-79, 119, 131-132). It also loads contacts and profile for `user.id`. When an admin clicks "Send" on an agent's template, it sends from the admin's account with the admin's contacts (likely 0).

### 4. NewsletterBuilder overwrites agent_id on save
`NewsletterBuilder` line 168 saves with `agent_id: user.id`. When an admin edits an agent's template via `/newsletter-builder/{id}`, it reassigns the template to the admin on save.

### 5. Agent Settings contact count may be correct but needs verification
The hook fetches all contacts and counts by `agent_id`. This appears correct. The "enabled" toggle works via upsert. The issue the user sees may be that the contact count shows 0 for agents who have contacts -- need to verify the query isn't filtered by RLS (admin role should see all contacts).

---

## Plan

### A. Add "Create Template for Agent" to AdminNewsletterTemplates

Add a "New Template" button with an agent selector dropdown. When admin picks an agent and clicks create, it calls `saveTemplate` with `agent_id` set to the chosen agent's ID, then navigates to `/newsletter-builder/{newId}`.

### B. Add Copy-to-Agent and Delete actions to template cards

Each template card gets:
- **Copy to Agent** button: opens a small dialog with agent selector, duplicates the template with the target agent's `agent_id`
- **Delete** button with confirmation dialog

Add delete and duplicate mutations to `useAdminNewsletter.ts`.

### C. Make SendSchedulePanel accept an `agentId` prop

| Current | New |
|---------|-----|
| `agent_id: user.id` everywhere | `agent_id: props.agentId \|\| user.id` |
| Loads contacts for `user.id` | Loads contacts for effective agent ID |
| Loads profile for `user.id` | Loads profile for effective agent ID |

The `AdminNewsletterTemplates` component already knows `sendTemplate.agent_id` -- pass it through as a prop.

### D. Make NewsletterBuilder preserve the template's agent_id

When loading an existing template, store its `agent_id` in state. On save, use the stored `agent_id` instead of `user.id`. For new templates (no templateId), continue using `user.id`.

### E. Fix contact count query to use explicit count

The current approach fetches ALL contact rows just to count them. Replace with a more targeted approach: query `contacts` grouped by agent_id using `.select('agent_id')` (already doing this). The RLS policy allows admins to see all contacts, so this should work. Add explicit `email` not-null filter since newsletters only go to contacts with email addresses -- this gives the admin an accurate "sendable contacts" count.

---

## Files to Change

| File | Changes |
|------|---------|
| `src/components/admin/AdminNewsletterTemplates.tsx` | Add "New Template" button with agent picker; add Copy-to-Agent and Delete actions on each card; add confirmation dialogs |
| `src/components/newsletter/builder/SendSchedulePanel.tsx` | Add optional `agentId` prop; use it for contact loading, profile loading, and send calls |
| `src/components/newsletter/builder/NewsletterBuilder.tsx` | Store loaded template's `agent_id`; use it on save instead of `user.id` |
| `src/hooks/useAdminNewsletter.ts` | Add delete template mutation; add duplicate template mutation; filter contact counts to only contacts with email |
| `src/pages/AdminNewsletter.tsx` | Pass delete/duplicate handlers to AdminNewsletterTemplates |

