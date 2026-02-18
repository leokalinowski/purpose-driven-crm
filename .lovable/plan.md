

# Sponsor Database (Admin Only)

## Overview

A new admin-only page to manage event sponsors with full tracking: company info, financials, event associations, contracts, and branding assets.

## What You Get

- A dedicated "Sponsor Database" page accessible only to admins
- Full CRUD for sponsors: add, edit, delete, search, filter
- Track company details, contact person, financials (amount, tier, payment status), event links, renewal dates, contract status, and logo
- Link sponsors to specific events
- Export sponsors as CSV

## Database Schema

A new `sponsors` table with these columns:

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| company_name | text | Required |
| contact_name | text | |
| contact_email | text | |
| contact_phone | text | |
| website | text | |
| logo_url | text | |
| sponsorship_tier | text | e.g. Gold, Silver, Bronze, Custom |
| sponsorship_amount | numeric | Dollar amount |
| payment_status | text | pending, paid, partial, overdue |
| contract_status | text | draft, active, expired, cancelled |
| renewal_date | date | |
| notes | text | |
| created_by | uuid | Admin who created it |
| created_at | timestamptz | |
| updated_at | timestamptz | |

A join table `sponsor_events` to link sponsors to events:

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| sponsor_id | uuid | FK to sponsors |
| event_id | uuid | FK to events |
| created_at | timestamptz | |

RLS policies: admin-only for all operations on both tables, using `get_current_user_role() = 'admin'`.

## New Files

### `src/pages/AdminSponsors.tsx`
The main page with:
- Search bar and tier/status filters
- Table listing all sponsors with sortable columns
- "Add Sponsor" button opening a dialog form
- Click a row to edit inline or via dialog
- Delete with confirmation
- Export CSV button
- Each sponsor row shows linked event count as a badge

### `src/components/admin/SponsorForm.tsx`
Reusable form (used for both add and edit) with fields for all columns. Includes:
- Text inputs for company/contact info
- Select dropdowns for tier, payment status, contract status
- Date picker for renewal date
- Multi-select for linking to events (fetched from events table)
- URL input for logo

### `src/hooks/useSponsors.ts`
Hook providing:
- Fetch all sponsors (with joined event count)
- Create, update, delete sponsor
- Link/unlink events
- Search and filter logic

## Modified Files

### `src/components/layout/AppSidebar.tsx`
Add a "Sponsor Database" link in the Administration section (using `Handshake` icon from lucide-react).

### `src/App.tsx`
Add route: `/admin/sponsors` pointing to `AdminSponsors` page.

## Technical Notes

- No storage bucket needed -- logo_url is a plain text URL field (admins paste a link)
- The page follows the same admin guard pattern as other admin pages (redirect if not admin)
- Sponsor-event links are managed through the `sponsor_events` join table with cascading deletes
- CSV export reuses the same batched-fetch pattern from the contact export feature

