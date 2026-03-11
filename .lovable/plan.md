

## Audit: Reminders & Dashboard Integration

### Reminders — Status

**Coaching/Scoreboard Reminder (`coaching-reminder` edge function)**: Functionally works. It queries `coaching_submissions` for the current week and sends emails to agents who haven't submitted. Since we didn't rename the table or change the `week_number`/`year`/`agent_id` columns, the reminder logic is fully intact.

**However**, the email body content is outdated. Lines 76-81 still list the old "Success Scoreboard" fields:
- "Attempts Made and Leads Contacted"
- "Appointments Set, Appointments Held, and Agreements Signed"  
- "Offers Made, # of Closings, and $ Closed (Amount)"

These no longer match what agents actually submit in the SphereSync Weekly Check-In (Conversations, Activation Attempts, Appointments Set, Contacts Added/Removed, Activation Day). The email should be updated to match the new vocabulary.

**SphereSync Email Reminder (`spheresync-email-function`)**: Completely unaffected. It deals with SphereSync tasks (calls/texts), not coaching submissions. Works as before.

### Dashboard — Status

**Fully connected.** The `useDashboardBlocks.ts` hook queries `coaching_submissions` directly and uses the data correctly:

| Dashboard Block | What it reads | Status |
|---|---|---|
| Block 2 (Weekly Tasks) | Checks if a submission exists for current week → shows "Submit Scoreboard" task | Works |
| Block 3 (Transaction Opportunity) | Reads `closings` column from all submissions this year | Works — `closings` column is untouched by our changes |
| Block 4 (Performance) | Checks submission existence per week for 8-week trend | Works |
| Block 5 (Accountability) | Uses coaching submission existence in completion calculations | Works |

No dashboard block reads `conversations`, `dials_made`, `leads_contacted`, or `deals_closed` — they only check whether a submission row exists and read the `closings` column. So all dashboard integrations are intact.

### Plan: Update Reminder Email Content

| # | File | Change |
|---|---|---|
| 1 | `supabase/functions/coaching-reminder/index.ts` | Update the email HTML body to use SphereSync vocabulary: Conversations (toward your 25/week target), Activation Attempts, Appointments Set, Contacts Added/Removed, Activation Day, and your weekly notes. Change the subject line and CTA text to reference "SphereSync Weekly Check-In" instead of "Weekly Performance Data". |

This is a single edge function file change — no database or frontend changes needed.

