

## Support Hub & Action Items System

### Overview
Build a comprehensive "Support Hub" for agents that combines two key features:
1. **Ticketing System** - Submit issues/requests that create ClickUp tasks with category tags
2. **Action Items Dashboard** - System-generated blockers that require agent attention

The system will include a dedicated `/support` page plus a compact widget on the agent dashboard.

---

### Architecture

```text
+------------------+     +------------------+     +------------------+
|   Agent Dashboard |     |    Support Hub    |     |     ClickUp      |
|     (Widget)      |---->|   (Full Page)     |---->|  (Single List)   |
+------------------+     +------------------+     +------------------+
        |                        |                        |
        v                        v                        v
+------------------+     +------------------+     +------------------+
| Action Items     |     | Ticket Form      |     | Webhook Sync     |
| (System-Gen)     |     | + Ticket History |     | (Status Updates) |
+------------------+     +------------------+     +------------------+
```

---

### Database Changes

**New Table: `support_tickets`**

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| agent_id | uuid | Reference to profiles.user_id |
| category | text | database, social, events, newsletter, spheresync, technical, general |
| subject | text | Brief description |
| description | text | Detailed message |
| priority | text | low, medium, high |
| status | text | open, in_progress, resolved, closed |
| clickup_task_id | text | ClickUp task ID for sync |
| assigned_to | text | Team member name (from ClickUp) |
| created_at | timestamptz | When submitted |
| updated_at | timestamptz | Last status change |
| resolved_at | timestamptz | When marked resolved |

**New Table: `agent_action_items`**

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| agent_id | uuid | Reference to profiles.user_id |
| item_type | text | no_contacts, no_metricool, no_coaching, pending_posts, incomplete_profile, incomplete_event |
| priority | text | high, medium, low |
| title | text | Display title |
| description | text | What needs to be done |
| action_url | text | Where to go to resolve |
| is_dismissed | boolean | If agent dismissed temporarily |
| dismissed_until | timestamptz | When to show again |
| created_at | timestamptz | When detected |
| resolved_at | timestamptz | When condition cleared |

---

### ClickUp Integration

**Configuration Required:**
- One "Support" list in ClickUp (you'll provide the List ID)
- Tags for categories: Database, Social, Events, Newsletter, SphereSync, Technical, General

**Assignee Mapping (configurable in admin settings):**

| Category | Default Assignee |
|----------|-----------------|
| Database/CRM | [Team member] |
| Social Media | [Team member] |
| Events | [Team member] |
| Newsletter | [Team member] |
| SphereSync | [Team member] |
| Technical | Leonardo |
| General | Leonardo |

---

### New Edge Functions

**1. `create-support-ticket/index.ts`**
- Receives ticket data from frontend
- Creates ClickUp task with appropriate tag and assignee
- Stores ticket in `support_tickets` table
- Returns confirmation

**2. `support-ticket-webhook/index.ts`**
- Receives ClickUp webhook updates
- Syncs status changes back to `support_tickets`
- Updates assigned_to when changed in ClickUp

**3. `generate-action-items/index.ts`**
- Runs on cron or triggered by events
- Checks each agent for missing setup items
- Creates/updates entries in `agent_action_items`
- Auto-resolves when condition is met

---

### Action Item Detection Logic

| Item Type | Detection Query | Priority | Action URL |
|-----------|----------------|----------|------------|
| `no_contacts` | `COUNT(contacts) = 0` | High | /database |
| `no_metricool` | `metricool_links.is_active = false` | Medium | /social-scheduler |
| `no_coaching_week` | No `coaching_submissions` in 7 days | Low | /coaching |
| `incomplete_profile` | Missing `headshot_url` or `phone_number` | Low | /profile (new) |
| `no_events` | `COUNT(events) = 0` AND agent onboarded > 30 days | Low | /events |

---

### Frontend Components

**1. New Page: `/support` (Support Hub)**

```text
+-------------------------------------------------------+
|  Support Hub                                          |
+-------------------------------------------------------+
|                                                       |
|  [!] ACTION ITEMS (3 urgent, 2 pending)               |
|  +---------------------------------------------------+|
|  | [Banner] Upload your contacts to get started     ||
|  |          with SphereSync → [Go to Database]      ||
|  +---------------------------------------------------+|
|  | [Card] Connect Metricool for social media        ||
|  | [Card] Submit this week's coaching numbers       ||
|  +---------------------------------------------------+|
|                                                       |
|  SUBMIT A REQUEST                                     |
|  +---------------------------------------------------+|
|  | Category: [Dropdown]                             ||
|  | Subject:  [Text input]                           ||
|  | Priority: [Low] [Medium] [High]                  ||
|  | Details:  [Textarea]                             ||
|  |                                 [Submit Request] ||
|  +---------------------------------------------------+|
|                                                       |
|  MY TICKETS                                           |
|  +---------------------------------------------------+|
|  | #123 | Can't upload CSV | Database | In Progress ||
|  | #122 | Event graphics   | Events   | Resolved    ||
|  +---------------------------------------------------+|
+-------------------------------------------------------+
```

**2. Dashboard Widget (Agent Dashboard)**

```text
+------------------------------------------+
|  Support & Action Items             [→]  |
+------------------------------------------+
|  [!] 2 items need your attention         |
|  • Upload contacts to Database           |
|  • Connect Metricool                     |
|                                          |
|  Recent Tickets:                         |
|  • CSV upload help - In Progress         |
+------------------------------------------+
```

**3. Sidebar Navigation Update**
- Add "Support Hub" item with icon (HelpCircle or LifeBuoy)
- Show badge count for unresolved action items

---

### File Changes Summary

**New Files:**
- `src/pages/Support.tsx` - Main Support Hub page
- `src/components/support/ActionItemsBanner.tsx` - High priority banner
- `src/components/support/ActionItemsCard.tsx` - Medium/low priority cards
- `src/components/support/TicketForm.tsx` - Submit ticket form
- `src/components/support/TicketHistory.tsx` - List of agent's tickets
- `src/components/support/SupportWidget.tsx` - Dashboard compact widget
- `src/hooks/useActionItems.ts` - Fetch action items for agent
- `src/hooks/useSupportTickets.ts` - Ticket CRUD operations
- `supabase/functions/create-support-ticket/index.ts` - Create ticket + ClickUp
- `supabase/functions/support-ticket-webhook/index.ts` - ClickUp sync
- `supabase/functions/generate-action-items/index.ts` - Detect blockers

**Modified Files:**
- `src/App.tsx` - Add /support route
- `src/components/layout/AppSidebar.tsx` - Add Support Hub nav item
- `src/pages/Index.tsx` - Add SupportWidget component
- `supabase/config.toml` - Add new edge functions

**New Database Migration:**
- Create `support_tickets` table with RLS policies
- Create `agent_action_items` table with RLS policies
- Create `support_config` table for assignee mappings

---

### Configuration Required After Implementation

You'll need to provide:
1. **ClickUp Support List ID** - The list where tickets should be created
2. **ClickUp Team ID** - For webhook registration
3. **Assignee Mapping** - ClickUp user IDs for each category (can be configured in admin settings)

---

### Implementation Phases

**Phase 1: Database & Core Infrastructure**
- Create database tables and migrations
- Set up RLS policies
- Create basic hooks for data fetching

**Phase 2: Action Items System**
- Implement detection logic
- Build action items components
- Add dashboard widget

**Phase 3: Ticketing System**
- Create ticket submission form
- Build ClickUp integration edge function
- Implement webhook for status sync

**Phase 4: Support Hub Page**
- Build full Support Hub page
- Add ticket history view
- Integrate all components

**Phase 5: Polish & Admin Settings**
- Add admin view for all tickets
- Create assignee configuration UI
- Add notification badges

---

### Security Considerations

- Agents can only see their own tickets and action items (RLS)
- Admins can see all tickets across agents
- ClickUp webhook validates signature before processing
- Service role key used only in edge functions

