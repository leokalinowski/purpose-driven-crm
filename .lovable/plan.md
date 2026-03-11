## Filter Support Categories by Role & Add Subscription Category

### Current State

All users see the same 8 categories: Database/CRM, Social Media, Events, Newsletter, SphereSync, Coaching, Technical Issue, General Question.

### Tier Access Mapping

- **Core**: SphereSync, Database, Newsletter, Scoreboard → sees those 4 + Technical, General, **Subscription**
- **Managed**: Core + Events, Pipeline, Social → sees all Core categories + Events, Social, **Subscription**
- **Agent/Admin**: Full access, no subscription concerns → sees all categories except Subscription

### Changes

**1. `src/hooks/useSupportTickets.ts**`

- Add `'subscription'` to the `TicketCategory` union type

**2. `src/components/support/TicketForm.tsx**`

- Accept a `userRole` prop (or import `useUserRole` directly)
- Define the full category list with a `minTier` field per category
- Filter categories based on role:
  - `subscription`: only for `core` and `managed`
  - `social`, `events`: only for `managed`, `agent`, `admin`
  - `database`, `spheresync`, `newsletter`, `scoreboard`, `technical`, `general`: all tiers

```text
Category          | Core | Managed | Agent | Admin
──────────────────|──────|─────────|───────|──────
Database / CRM    |  ✓   |    ✓    |   ✓   |   ✓
SphereSync        |  ✓   |    ✓    |   ✓   |   ✓
Newsletter        |  ✓   |    ✓    |   ✓   |   ✓
Scoreboard          |  ✓   |    ✓    |   ✓   |   ✓
Technical Issue   |  ✓   |    ✓    |   ✓   |   ✓
General Question  |  ✓   |    ✓    |   ✓   |   ✓
Subscription      |  ✓   |    ✓    |       |
Events            |      |    ✓    |   ✓   |   ✓
Social Media      |      |    ✓    |   ✓   |   ✓
```

**3. `src/pages/Support.tsx**`

- Pass role info to `TicketForm` (or let `TicketForm` call `useUserRole` itself — cleaner since Support.tsx doesn't currently import it)

### Implementation Detail

Import `useUserRole` inside `TicketForm` and filter the categories array using a simple role check. No changes needed to the edge function or database since `subscription` is just a new string category value — the ClickUp routing in `create-support-ticket` can default unmatched categories to the General assignment.