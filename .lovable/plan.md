

# Fix Email Template System - Custom Fields Not Populating

## Problem
The email template system is non-functional because three required database tables were never created. Both the global and event-specific template hooks (`useGlobalEmailTemplates`, `useEmailTemplates`) are stubs that log warnings and return empty data. The preview shows generic placeholders like `[Event Title]` and `[Agent Name]` instead of actual event data. Additionally, the RSVP confirmation edge function completely ignores saved templates and uses its own hardcoded HTML.

## Root Cause
- `global_email_templates` table does not exist
- `event_email_templates` table does not exist
- `event_emails` table does not exist (for tracking sent emails)
- Both hooks contain stub code with `console.warn('table does not exist')`
- The preview function in `EmailTemplateEditor` and `GlobalTemplateEditor` never fetches actual event/agent data

## What We're Fixing

### 1. Create Three Database Tables

**`global_email_templates`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| email_type | text | confirmation, reminder_7day, etc. |
| subject | text | Subject line with variables |
| html_content | text | HTML body with variables |
| text_content | text | Optional plain text version |
| is_active | boolean | Default true |
| created_at / updated_at | timestamptz | Auto |

**`event_email_templates`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| event_id | uuid | FK to events |
| email_type | text | Same types as global |
| subject | text | Subject line with variables |
| html_content | text | HTML body with variables |
| text_content | text | Optional plain text |
| is_active | boolean | Default true |
| created_at / updated_at | timestamptz | Auto |

**`event_emails`** (tracking table)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| event_id | uuid | FK to events |
| rsvp_id | uuid | FK to event_rsvps |
| email_type | text | Type of email sent |
| recipient_email | text | Recipient |
| subject | text | Subject used |
| status | text | sent/failed/delivered/opened/clicked |
| sent_at | timestamptz | When sent |
| delivered_at / opened_at / clicked_at / replied_at / bounced_at | timestamptz | Tracking timestamps |
| resend_id | text | Resend API ID |
| error_message | text | If failed |
| created_at / updated_at | timestamptz | Auto |

RLS policies:
- `global_email_templates`: Admin-only for all operations
- `event_email_templates`: Admins full access; agents can manage templates for their own events
- `event_emails`: Admins full access; agents can view emails for their own events; service role insert for edge functions

### 2. Update `useGlobalEmailTemplates` Hook
Replace stub code with actual Supabase queries to `global_email_templates` table -- fetch, create, update, and delete operations.

### 3. Update `useEmailTemplates` Hook
Replace stub code with actual Supabase queries to `event_email_templates` and `event_emails` tables. Implement the send functions (`sendReminderEmails`, `sendThankYouEmails`, `sendNoShowEmails`) to call the appropriate edge functions.

### 4. Fix Preview to Show Actual Event Data
Update `EmailTemplateEditor.renderPreview()` to accept and use actual event data (title, date, location, agent info) when available, falling back to descriptive placeholders only when no event is selected. The `EmailManagement` component already loads event data -- pass it down.

Similarly update `GlobalTemplateEditor.renderPreview()` to use sample realistic data rather than `[Event Title]`.

### 5. Update RSVP Confirmation Edge Function
Modify `rsvp-confirmation-email/index.ts` to:
1. First check for an event-specific template in `event_email_templates`
2. If none, check for a global template in `global_email_templates`
3. If none, fall back to the current hardcoded HTML
4. Use `buildEmailTemplate`-style variable replacement with actual event/agent data
5. Keep the existing `event_emails` tracking insert (now the table will exist)

### 6. Update Reminder Email Edge Function
Fix `event-reminder-email/index.ts` to follow the same template resolution chain (event-specific, then global, then hardcoded default) and properly query the now-existing tables.

## Files to Create
- Migration SQL file for the three new tables + RLS policies

## Files to Modify
- `src/hooks/useGlobalEmailTemplates.ts` -- Replace stubs with real Supabase queries
- `src/hooks/useEmailTemplates.ts` -- Replace stubs with real Supabase queries
- `src/components/events/email/EmailTemplateEditor.tsx` -- Fix preview to use actual event data
- `src/components/events/email/GlobalTemplateEditor.tsx` -- Fix preview with realistic sample data
- `src/components/events/email/EmailManagement.tsx` -- Pass event data to template editors for preview
- `supabase/functions/rsvp-confirmation-email/index.ts` -- Use saved templates with variable replacement
- `supabase/functions/event-reminder-email/index.ts` -- Use saved templates with variable replacement

## Technical Details

### Template Resolution Order (Edge Functions)
```text
1. Check event_email_templates WHERE event_id = X AND email_type = Y AND is_active = true
2. If not found, check global_email_templates WHERE email_type = Y AND is_active = true
3. If not found, use hardcoded default HTML (current behavior as fallback)
4. Replace {event_title}, {agent_name}, etc. with actual data from event + profile
```

### Preview Data Flow
The `EmailManagement` component already fetches event details and agent profiles. It will pass the selected event's actual data (title, date, location, agent name, etc.) to the `EmailTemplateEditor`, which will use it in `renderPreview()` instead of `[Event Title]` placeholders.

### No Breaking Changes
- The RSVP confirmation edge function's existing hardcoded HTML becomes the last-resort fallback
- If no templates are saved, everything works exactly as before
- Once templates are saved, they take priority

