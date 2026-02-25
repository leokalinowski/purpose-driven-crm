

# Fix: Campaign History Not Showing Data

## Root Cause

The `newsletter_campaigns` table has a CHECK constraint that only allows these status values: `'draft'`, `'sent'`, `'scheduled'`.

The `newsletter-template-send` edge function inserts the campaign record with `status: 'sending'` -- which **violates the constraint** and causes the insert to fail silently. Since `campaignRecord` ends up `null`, the `campaign_id` in `email_logs` is also `null`, breaking the entire campaign tracking chain.

Evidence:
- `newsletter_campaigns` table has **0 rows** total
- The email_log for Leonardo's newsletter has `campaign_id: null`
- Constraint: `CHECK (status = ANY (ARRAY['draft', 'sent', 'scheduled']))`

## Fix

Two changes needed:

### 1. Database: Add `'sending'` and `'completed'` to the CHECK constraint

Update the constraint to allow all statuses the code uses: `'draft'`, `'sending'`, `'sent'`, `'scheduled'`, `'completed'`, `'failed'`.

### 2. Edge Function: No code change needed

The function already uses `'sending'` as the initial status and updates to `'sent'` or `'failed'` after completion. Once the constraint is fixed, the flow will work correctly.

## Files to Modify

| File | Change |
|------|--------|
| New migration | Drop and recreate the CHECK constraint with all valid statuses |

## Impact

After this fix, future newsletter sends will correctly create campaign records, link email_logs to campaigns, and populate the Campaign History tab. The previously sent newsletter (Leonardo's) unfortunately cannot be retroactively linked since no campaign record was created.

