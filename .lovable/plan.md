

# Fix: Agent Overview Contact Counts -- Show Full Picture

## Root Cause

The contact counts are technically correct -- the query counts contacts **with email** (since that's who can receive newsletters). But the numbers look wrong because admins mentally compare them to the total contact counts they see on the Database page.

Real data from the database:

```text
Agent               Total Contacts   With Email
─────────────────── ────────────────  ──────────
Traci Johnson       156              5
Ashley Spencer      286              0
Timothy Raiford     509              321
JJ Gagliardi        697              686
Amy Summersgill     322              173
Samir Redwan        298              274
```

Traci has 156 contacts but only 5 have email addresses. Ashley has 286 but zero emails. The UI shows "5" and "0" with the label "Contacts with email" -- technically correct but confusing without the total for context.

## Fix

Modify the Agent Overview cards to show **both** counts clearly:

- **Total contacts** (the number the admin expects to see)
- **With email** (the newsletter-ready subset, shown as a secondary stat)

This also reveals an operational insight: agents like Traci and Ashley need email data enrichment before newsletters are viable.

### Changes to `src/hooks/useAdminNewsletter.ts`

Add a second parallel count query for **total** contacts per agent (without the email filter). Return both `contact_count` (total) and `email_contact_count` (with email) in the agent profile.

### Changes to `src/pages/AdminNewsletter.tsx`

Update the Agent Overview card to display:
- Primary stat: total contact count (matches Database page)
- Secondary stat below it: "X with email" (newsletter-ready count)

This gives admins immediate visibility into which agents need email enrichment.

### Interface update in `useAdminNewsletter.ts`

Add `email_contact_count` to the `AgentProfile` interface.

## Files to Modify

| File | Change |
|------|--------|
| `src/hooks/useAdminNewsletter.ts` | Add total contact count query alongside email count; update interface and merge logic |
| `src/pages/AdminNewsletter.tsx` | Display both total and email counts in Agent Overview cards |

