

# Custom RSVP Questions for Events

## Overview

Build a reusable custom questions system that lets agents (or admins) define per-event RSVP questions. Answers are stored securely and only visible to the owning agent and admins -- never to the public.

## Database Changes

### 1. New table: `event_rsvp_questions`

Stores the question definitions per event.

```sql
CREATE TABLE public.event_rsvp_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'text',  -- text, select, checkbox, textarea
  options JSONB,          -- for select/checkbox: ["Option A", "Option B"]
  is_required BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

- RLS: Authenticated agents/admins can manage questions for their own events; public anonymous users can SELECT (to render the form).

### 2. New table: `event_rsvp_answers`

Stores each respondent's answers, linked to the RSVP.

```sql
CREATE TABLE public.event_rsvp_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rsvp_id UUID NOT NULL REFERENCES public.event_rsvps(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.event_rsvp_questions(id) ON DELETE CASCADE,
  answer_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

- RLS: **No public SELECT**. Only the owning agent or admins can read answers -- enforced via a SECURITY DEFINER RPC function (same pattern as `event_rsvps` PII protection).

### 3. New RPC: `get_rsvp_answers`

A SECURITY DEFINER function that returns answers for a given event, restricted to authenticated users who own the event or are admins.

### 4. New RPC: `submit_rsvp_answers`

A SECURITY DEFINER function that accepts an RSVP ID and an array of `{question_id, answer_text}` objects. Validates that the RSVP exists and inserts answers. This allows anonymous users to submit answers at RSVP time without direct table access.

## Frontend Changes

### 1. Question Builder (Agent/Admin side)

**File: `src/components/events/rsvp/RSVPQuestionBuilder.tsx`** (new)

- A form where agents add, edit, reorder, and remove custom questions for an event
- Supports question types: Short Text, Long Text, Single Select (dropdown), Checkboxes
- Each question has: label, type, required toggle, options (for select/checkbox)
- Drag or arrow-button reordering via `sort_order`

**Integration:** Embedded in the Event Form (`EventForm.tsx`) as a collapsible section -- "Custom RSVP Questions"

### 2. Dynamic RSVP Form (Public side)

**File: `src/components/events/rsvp/RSVPForm.tsx`** (modified)

- Fetch `event_rsvp_questions` for the event on mount
- Render each question dynamically below the existing fields (name, email, phone, guests)
- Validate required custom questions before submit
- After RSVP is created, call the `submit_rsvp_answers` RPC with the collected answers

**File: `src/hooks/useRSVP.ts`** (modified)

- Add `getEventQuestions(eventId)` -- public SELECT on `event_rsvp_questions`
- Add `submitRSVPAnswers(rsvpId, answers[])` -- calls the `submit_rsvp_answers` RPC
- Extend `RSVPFormData` to include `custom_answers: Record<string, string>`

### 3. Viewing Answers (Agent/Admin side)

**File: `src/components/events/RSVPManagement.tsx`** (modified)

- Each RSVP row gets an expandable section or dialog showing the respondent's custom answers
- Answers fetched via the `get_rsvp_answers` RPC (authenticated only)
- CSV export extended to include custom question columns

### 4. New hook for question management

**File: `src/hooks/useRSVPQuestions.ts`** (new)

- CRUD operations for `event_rsvp_questions` (authenticated)
- `getEventQuestions(eventId)` for public rendering

## Security Model

| Table | Anonymous | Agent (owner) | Admin |
|---|---|---|---|
| `event_rsvp_questions` | SELECT (read questions to render form) | Full CRUD (own events) | Full CRUD (all events) |
| `event_rsvp_answers` | INSERT via RPC only | SELECT via RPC (own events) | SELECT via RPC (all events) |

- No direct public SELECT on `event_rsvp_answers` -- all reads go through a SECURITY DEFINER RPC that checks ownership
- Anonymous INSERT on answers is only possible through the `submit_rsvp_answers` RPC, which validates the RSVP ID exists

## Technical Details

### Files created
| File | Purpose |
|---|---|
| `src/components/events/rsvp/RSVPQuestionBuilder.tsx` | Admin UI to define custom questions per event |
| `src/hooks/useRSVPQuestions.ts` | Hook for question CRUD and answer retrieval |

### Files modified
| File | Change |
|---|---|
| `src/components/events/EventForm.tsx` | Add collapsible "Custom RSVP Questions" section with the builder |
| `src/components/events/rsvp/RSVPForm.tsx` | Fetch and render custom questions, collect answers |
| `src/hooks/useRSVP.ts` | Add `submitRSVPAnswers` RPC call, extend form data type |
| `src/components/events/RSVPManagement.tsx` | Show answers per RSVP, extend CSV export |

### Database migration
- Creates `event_rsvp_questions` table with public SELECT + authenticated CRUD RLS
- Creates `event_rsvp_answers` table with no public SELECT RLS
- Creates `submit_rsvp_answers` SECURITY DEFINER function
- Creates `get_rsvp_answers` SECURITY DEFINER function (ownership check)

