

## Redesign Survey Results: Full Response Detail View

### Problem

The current "All Responses" table only shows 6 of 13 fields, and long text is truncated with `max-w-[200px] truncate`. Array fields like pipeline stages, must-have fields, activity types, integration priorities, and desired views are completely hidden. Free-text fields (additional fields, biggest pain point, additional comments) are also missing.

### Solution

Replace the cramped table with a **card-per-response layout** using expandable accordions. Each response gets a card showing the respondent's name, email, and date at a glance, with all 13 fields visible when expanded.

### Layout

```text
┌─────────────────────────────────────────────┐
│ ▶ Jane Smith · jane@example.com · Apr 3     │
├─────────────────────────────────────────────┤
│  Pipeline Stages: [New Lead] [Contacted]... │
│  Buyer/Seller Split: "Yes, completely..."   │
│  Must-Have Fields: [Deal Value] [MLS #]...  │
│  Additional Fields: "Lender contact info"   │
│  Follow-Up Automation: "Very interested..." │
│  Activity Types: [Phone Calls] [Emails]...  │
│  Integration Priorities: [SphereSync]...    │
│  Biggest Pain Point: "I lose track of..."   │
│  Desired Views: [Kanban] [List View]        │
│  Mobile Importance: "Critical — I'm on..."  │
│  Additional Comments: "Love the idea!"      │
└─────────────────────────────────────────────┘
```

### Changes

**File: `src/pages/AdminSurveyResults.tsx`**

- Replace the `<Table>` section (lines 124-154) with an accordion-based card list
- Each response renders as a collapsible `Accordion.Item` with:
  - **Header**: Name, email, submission date
  - **Body**: All 13 survey fields in a clean 2-column grid
  - Array fields rendered as inline badges/chips
  - Free-text fields shown in full (no truncation)
- Import `Accordion` from the existing UI components
- Keep the charts section and export button unchanged

### Technical Details

- Uses existing `src/components/ui/accordion.tsx` and `src/components/ui/badge.tsx`
- No new components or dependencies needed
- 1 file modified: `src/pages/AdminSurveyResults.tsx`

