## Support Hub & Action Items System

### Status: Phase 1-4 Complete ✅

The Support Hub system has been implemented with the following components:

---

### Database Tables Created

1. **`support_tickets`** - Stores agent support requests
2. **`agent_action_items`** - Stores system-generated blockers for agents
3. **`support_config`** - Admin-configurable assignee mappings for categories

All tables have proper RLS policies for agent/admin access.

---

### Frontend Components

- `src/pages/Support.tsx` - Main Support Hub page
- `src/components/support/ActionItemsBanner.tsx` - High priority urgent banners
- `src/components/support/ActionItemsCard.tsx` - Medium/low priority cards
- `src/components/support/TicketForm.tsx` - Submit ticket form
- `src/components/support/TicketHistory.tsx` - List of agent's tickets
- `src/components/support/SupportWidget.tsx` - Dashboard widget

### Hooks

- `src/hooks/useSupportTickets.ts` - Ticket CRUD + admin functions
- `src/hooks/useActionItems.ts` - Action items fetching and dismissal

### Edge Functions

- `supabase/functions/create-support-ticket/index.ts` - Creates ticket + ClickUp task
- `supabase/functions/support-ticket-webhook/index.ts` - Syncs ClickUp status changes
- `supabase/functions/generate-action-items/index.ts` - Detects blockers for agents

---

### Configuration Required

To enable ClickUp integration, add these secrets:

1. **`CLICKUP_SUPPORT_LIST_ID`** - The ClickUp list ID where tickets should be created

The system already has `CLICKUP_API_TOKEN` configured.

To configure assignees per category, update the `support_config` table with ClickUp user IDs.

---

### Action Item Detection

The `generate-action-items` function checks for:

| Item Type | Detection | Priority |
|-----------|-----------|----------|
| `no_contacts` | No contacts in database | High |
| `no_metricool` | No active Metricool link | Medium |
| `no_coaching` | No coaching submission in 7 days | Low |
| `incomplete_profile` | Missing headshot or phone | Low |

Run the function manually or set up a cron job to detect blockers periodically.

---

### Future Enhancements (Phase 5)

- [ ] Admin view for all tickets across agents
- [ ] Badge count on sidebar for unresolved items
- [ ] ClickUp webhook registration UI
- [ ] More action item types (pending_posts, incomplete_event)
