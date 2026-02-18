

# Sponsor Database Enhancements

## Overview

Restructure the Sponsor Database to remove unused fields, add multi-contact support per company, track in-kind contributions alongside monetary ones, calculate historical totals, and allow logo file uploads.

## Changes Summary

1. **Remove** sponsorship_tier, contract_status, renewal_date columns
2. **Add** `sponsor_contacts` table for multiple contacts per company (with region)
3. **Add** `contribution_type` field to `sponsor_events` (money, food, venue, drinks, raffle, other)
4. **Add** `contribution_amount` and `contribution_description` to `sponsor_events` so each event link tracks what was provided
5. **Calculate** historical total from `sponsor_events` contribution amounts
6. **Create** a `sponsor-logos` storage bucket for logo uploads
7. **Update** all 3 files (hook, form, page) to reflect these changes

---

## Database Migration

### Drop unused columns from `sponsors`
- `sponsorship_tier`
- `contract_status`
- `renewal_date`
- `contact_name`, `contact_email`, `contact_phone` (moved to separate table)
- `sponsorship_amount` (now tracked per event in `sponsor_events`)

### New table: `sponsor_contacts`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| sponsor_id | uuid | FK to sponsors, ON DELETE CASCADE |
| contact_name | text | Required |
| contact_email | text | |
| contact_phone | text | |
| region | text | e.g. "DMV", "Hampton Roads" |
| is_primary | boolean | Default false |
| created_at | timestamptz | |

Admin-only RLS.

### Modify `sponsor_events` -- add columns
| Column | Type | Notes |
|--------|------|-------|
| contribution_type | text | money, food, venue, drinks, raffle, other |
| contribution_amount | numeric | Dollar value (if applicable) |
| contribution_description | text | Free text, e.g. "Covered all catering" |

### Create storage bucket `sponsor-logos`
- Public bucket for logo display
- Admin-only upload/delete RLS policies

---

## File Changes

### `src/hooks/useSponsors.ts`
- Remove tier/contract/renewal from Sponsor interface
- Remove single contact fields, add `contacts: SponsorContact[]`
- Fetch `sponsor_contacts` alongside sponsors
- Fetch `sponsor_events` with contribution data to compute `total_contributed` per sponsor
- Add CRUD mutations for contacts (add/remove/update contacts inline)
- Add logo upload/delete helpers using `supabase.storage.from('sponsor-logos')`

### `src/components/admin/SponsorForm.tsx`
- Remove tier, contract status, renewal date fields
- Remove single contact fields
- Add a "Contacts" section with ability to add multiple contacts (name, email, phone, region) -- inline add/remove rows
- Change event linking to also capture contribution_type, contribution_amount, and contribution_description per event
- Replace logo URL text input with a file upload input (with preview)

### `src/pages/AdminSponsors.tsx`
- Remove tier filter and tier/contract columns from table
- Add "Total Contributed" column showing the sum from all linked events
- Show primary contact in the Contact column (with a count badge if multiple)
- Update CSV export to reflect new fields
- Show logo from storage URL

---

## Technical Details

- Logo upload uses `supabase.storage.from('sponsor-logos').upload(...)` with a path like `{sponsor_id}/logo.{ext}`
- Historical total is computed client-side by summing `contribution_amount` across all `sponsor_events` rows for each sponsor
- The contribution_type uses a free-form approach with suggested values (money, food, venue, drinks, raffle, other) rather than a strict enum, for flexibility
- Contacts are managed in a sub-form within the sponsor dialog -- no separate page needed

