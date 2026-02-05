
## Configure Support Ticket Category Assignments

### Summary

Update the support system to route tickets to the correct team members via ClickUp, and add a new "Coaching/Success Scoreboard" category assigned to Pam.

---

### Implementation Details

#### 1. Update support_config Table

Update existing categories with correct assignee names and ClickUp IDs:

| Category | Assignee Name | ClickUp ID |
|----------|---------------|------------|
| database | Leonardo | 90173434 |
| newsletter | Leonardo | 90173434 |
| spheresync | Leonardo | 90173434 |
| technical | Leonardo | 90173434 |
| social | JJ Gagliardi | 4478890 |
| events | Kate Atkinson | 87391446 |
| general | Kate Atkinson | 87391446 |

Add new coaching category:

| Category | Assignee Name | ClickUp ID |
|----------|---------------|------------|
| coaching | Pam O'Bryant | 81570896 |

#### 2. Update TypeScript Types

Add 'coaching' to the `TicketCategory` type in `useSupportTickets.ts`:

```typescript
export type TicketCategory = 'database' | 'social' | 'events' | 'newsletter' | 'spheresync' | 'technical' | 'general' | 'coaching';
```

#### 3. Update TicketForm Categories

Add the coaching option to the categories dropdown in `TicketForm.tsx`:

```typescript
const categories: { value: TicketCategory; label: string }[] = [
  { value: 'database', label: 'Database / CRM' },
  { value: 'social', label: 'Social Media' },
  { value: 'events', label: 'Events' },
  { value: 'newsletter', label: 'Newsletter' },
  { value: 'spheresync', label: 'SphereSync' },
  { value: 'coaching', label: 'Success Scoreboard / Coaching' },  // NEW
  { value: 'technical', label: 'Technical Issue' },
  { value: 'general', label: 'General Question' },
];
```

---

### Files to Modify

| File | Change |
|------|--------|
| `src/hooks/useSupportTickets.ts` | Add 'coaching' to TicketCategory type |
| `src/components/support/TicketForm.tsx` | Add coaching category to dropdown |

### Database Changes

Execute SQL to update `support_config`:

```sql
-- Update existing categories with ClickUp IDs
UPDATE support_config SET assignee_name = 'Leonardo', clickup_assignee_id = '90173434' WHERE category = 'database';
UPDATE support_config SET assignee_name = 'Leonardo', clickup_assignee_id = '90173434' WHERE category = 'newsletter';
UPDATE support_config SET assignee_name = 'Leonardo', clickup_assignee_id = '90173434' WHERE category = 'spheresync';
UPDATE support_config SET assignee_name = 'Leonardo', clickup_assignee_id = '90173434' WHERE category = 'technical';
UPDATE support_config SET assignee_name = 'JJ Gagliardi', clickup_assignee_id = '4478890' WHERE category = 'social';
UPDATE support_config SET assignee_name = 'Kate Atkinson', clickup_assignee_id = '87391446' WHERE category = 'events';
UPDATE support_config SET assignee_name = 'Kate Atkinson', clickup_assignee_id = '87391446' WHERE category = 'general';

-- Add new coaching category
INSERT INTO support_config (category, assignee_name, clickup_assignee_id)
VALUES ('coaching', 'Pam O''Bryant', '81570896');
```

---

### After Implementation

Once approved, tickets will automatically:
1. Create a task in ClickUp when submitted
2. Assign to the correct team member based on category
3. Include the new "Success Scoreboard / Coaching" option for agents
