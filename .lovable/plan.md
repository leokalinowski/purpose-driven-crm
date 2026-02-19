

# Smart Pipeline Questionnaire - Public Landing Page

## Overview
Build a Google Forms-style public survey page at `/survey/pipeline` where agents can submit their preferences for the upcoming Smart Pipeline feature. Responses are stored in a new `pipeline_survey_responses` Supabase table. An admin view at `/admin/survey-results` will display submitted responses.

## What We're Building

### 1. New Database Table: `pipeline_survey_responses`
Stores each agent's answers as a single row with structured columns:

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| agent_name | text | Required |
| email | text | Required |
| created_at | timestamptz | auto |
| pipeline_stages | text[] | Which stages they want |
| separate_buyer_seller | text | Yes/No/Maybe |
| must_have_fields | text[] | Multi-select checkboxes |
| additional_fields | text | Free text |
| follow_up_automation | text | Interest level |
| activity_types | text[] | Which activities to track |
| integration_priorities | text[] | Which integrations matter most |
| biggest_pain_point | text | Free text |
| desired_views | text[] | Kanban/List/Calendar |
| mobile_importance | text | Rating |
| additional_comments | text | Free text |

RLS: Public INSERT (no auth needed), admin-only SELECT/DELETE.

### 2. New Page: Survey Landing (`/survey/pipeline`)
- **Public page** (no auth required), styled like Google Forms with a purple/teal header banner
- Sections with clear headings matching the 30-question questionnaire from our earlier discussion, condensed into ~12 actionable fields
- Mix of radio groups, checkbox groups, and free-text fields
- Progress indicator showing current section
- Success confirmation screen after submission
- Mobile-responsive

**Sections:**
1. **Your Info** -- Name, Email
2. **Pipeline Stages** -- Checkboxes for desired stages, radio for separate buyer/seller pipelines
3. **Fields & Data** -- Checkboxes for must-have fields, free text for extras
4. **Automation & Activities** -- Interest in follow-up automation, which activity types to track
5. **Integrations** -- Which existing features to connect (SphereSync, Events, Coaching, Transactions)
6. **Views & Usability** -- Preferred views, mobile importance, free-text for pain points and comments

### 3. New Page: Admin Survey Results (`/admin/survey-results`)
- Protected admin page showing all responses in a table
- Summary counts for multi-select fields (e.g., "12 agents want Kanban view")
- Export to CSV option
- Simple bar charts for the most popular choices using Recharts (already installed)

### 4. Route & Navigation Updates
- Add `/survey/pipeline` route (public, no layout wrapper)
- Add `/admin/survey-results` route (protected, inside Layout)
- Add sidebar link under Admin section

## Technical Details

### Files to Create
- `src/pages/PipelineSurvey.tsx` -- Public survey form page
- `src/pages/AdminSurveyResults.tsx` -- Admin results dashboard
- Migration SQL for `pipeline_survey_responses` table

### Files to Modify
- `src/App.tsx` -- Add two new routes
- `src/components/layout/AppSidebar.tsx` -- Add admin sidebar link
- `supabase/config.toml` -- No edge function needed (direct Supabase insert)

### Survey Form Implementation
- Uses `react-hook-form` + `zod` for validation (already installed)
- Multi-step form with sections, using local state for current step
- Each section rendered as a Card with the Google Forms purple-top-bar aesthetic
- On submit: direct `supabase.from('pipeline_survey_responses').insert(...)` call (public insert RLS)
- Shows a confirmation card with confetti (already installed: `canvas-confetti`)

### RLS Policies
```sql
-- Anyone can submit
CREATE POLICY "Public can submit survey" ON pipeline_survey_responses
  FOR INSERT WITH CHECK (true);

-- Only admins can read
CREATE POLICY "Admins can view survey responses" ON pipeline_survey_responses
  FOR SELECT USING (get_current_user_role() = 'admin');

-- Only admins can delete
CREATE POLICY "Admins can delete survey responses" ON pipeline_survey_responses
  FOR DELETE USING (get_current_user_role() = 'admin');
```

### Admin Results Page
- Table listing all responses with timestamp and agent name
- Aggregated bar charts (Recharts) showing:
  - Most requested pipeline stages
  - Most wanted fields
  - Integration priorities
  - Preferred views
- CSV export button using `papaparse` (already installed)

