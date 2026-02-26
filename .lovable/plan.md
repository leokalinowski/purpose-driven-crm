

# Fix OTC Sync: GCI, Stage Mapping, and Data Quality

## Problems Found (from DB + API analysis)

**1. GCI values are wrong** — Some stored as percentages (`3.5`, `11.359`, `1`, `2`) instead of dollar amounts. The `parseCommissionDollar` function extracts `3.5` from `"3.5%"` and stores it as $3.50 instead of computing `0.035 × sale_price`. Meanwhile values like `"2.5% ($32,500)"` correctly extract $32,500.

**2. All 19 transactions stuck as `under_contract`** — `mapStage()` only recognizes "closed"/"settled" in `contract_status`. OTC uses: "Closed", "Contract Maintenance", "Contract Setup", "Listing", "Listing-Complete", "On Hold", "Compliance Only", "Archive", "Post-Occ". Additionally, transactions with `closing_date` in the past (some from 2024) should be marked closed regardless of status text.

**3. Client names all "Unknown"** — `buyer_name`/`seller_name` field keys don't exist in OTC. The `agent_name` field key exists in `field_values` and contains the REOP agent name. For client identification, `contract_title` contains the property address (not useful). Should extract client info from `important_notes` where available, or leave blank rather than "Unknown".

**4. Dashboard KPIs show $0** — Because metrics filter on `transaction_stage === 'closed'` and nothing is marked closed. Direct consequence of issue #2.

**5. `referral_amount` field from OTC screenshot** — The screenshot shows a "Referral Amount" column. This field key isn't in the first 50 properties' `field_values` but likely exists on closed properties. Should be captured as an additional data point.

## Changes

### `supabase/functions/opentoclose-sync/index.ts`

- **Fix `parseCommissionDollar`**: Add `salePrice` parameter. When value contains `%` but no `$` amount, or when extracted number < 100, compute `(value / 100) * salePrice`
- **Fix `mapStage`**: Add `closingDate` parameter. If `closing_date` is in the past → `closed`. Map "Contract Maintenance"/"Contract Setup" → `under_contract`, "Listing"/"Listing-Complete" → `listing`, "Closed" → `closed`, "Archive"/"Post-Occ" → `closed`
- **Fix `mapStatus`**: Same closing_date logic — past closing = `closed`, otherwise `ongoing`
- **Fix `client_name`**: Remove "Unknown" default, try parsing client info from notes after the RA line, fall back to `null`
- **Capture additional fields**: `referral_amount`, `scalable_tc_fee`, `agent_admin_fee`, `brokerage`, `team_name`, `coordinator`, `contract_status` (raw value) into `raw_api_data`
- **Fix `commission_rate`**: Extract the percentage number from broker fields (e.g., `2.5` from `"2.5% ($32,500)"`)
- **Enhance discover mode**: Include all commission-related field values and contract_status values across samples

### `src/components/admin/AdminTransactionsDashboard.tsx`

- Add "Type" (Buy/Sell) column to transaction tables
- Show raw `contract_status` from OTC instead of computed stage in badge
- Add total transaction counts to header (e.g., "19 total: 12 closed, 7 active")

### No changes needed to hooks
The metric calculations in `useAdminTransactions.ts` and `useTransactions.ts` are correct — they just need properly staged data.

### Data refresh
After deploying the edge function fix, a re-sync will upsert all 19+ records with corrected GCI, stage, and status values via the existing `otc_deal_id` conflict resolution.

