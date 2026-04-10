

## Fix: "Never Checked" Count Showing Already-Checked DNC Contacts

### Root Cause
47 of Pam's contacts were flagged as `dnc = true` by an older version of the DNC check function that did **not** set `dnc_last_checked`. The current stats query counts all contacts with `dnc_last_checked IS NULL` as "Never Checked," even though they've clearly been checked (they're on the DNC list).

### Changes

**1. Fix the stats query in `useDNCStats.ts` (line 53-59)**
Add `.eq('dnc', false)` to the "Never Checked" query so it only counts contacts that genuinely haven't been checked yet.

**2. Backfill the legacy data (SQL migration)**
Update the 47 contacts that have `dnc = true` but `dnc_last_checked IS NULL` — set their `dnc_last_checked` to `now()` since they were already verified.

```sql
UPDATE contacts
SET dnc_last_checked = now()
WHERE dnc = true AND dnc_last_checked IS NULL;
```

**3. Same fix in admin stats hook**
Apply the same `.eq('dnc', false)` filter to the admin version of the stats query if it has the same issue.

### Result
- "Never Checked" will show **0** for Pam (all her contacts have been processed)
- "Safe to Call" and "DNC Listed" numbers remain accurate
- Future contacts flagged as DNC will always have `dnc_last_checked` set (already fixed in current edge function code)

### Files Modified
- `src/hooks/useDNCStats.ts` — add `dnc = false` filter to "Never Checked" query
- Admin DNC stats hook (if applicable) — same filter fix
- New SQL migration — backfill `dnc_last_checked` for legacy DNC contacts

