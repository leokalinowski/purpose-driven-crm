

## Bug Fix: RSVP Custom Question Answers Not Saving

### Root Cause

The `submitAnswers` function in `src/hooks/useRSVPQuestions.ts` (line 93) calls:

```typescript
supabase.rpc('submit_rsvp_answers', {
  p_rsvp_id: rsvpId,
  p_answers: JSON.stringify(answers),  // ← BUG: double-serializes
});
```

The Supabase JS client automatically serializes JS objects/arrays to jsonb. By calling `JSON.stringify` first, the value arrives as a **scalar string** instead of a JSON array. The database RPC then fails with `"cannot extract elements from a scalar"` when it tries to call `jsonb_array_elements()`.

### Evidence

- Tested end-to-end: submitted RSVP with "Paper to shred" + "General junk" checkboxes and "Ashley Spencer" referral answer
- RSVP was created successfully (id: `217931dc-...`)
- **Zero answers saved** in `event_rsvp_answers` table
- Console error: `"cannot extract elements from a scalar"` at `RSVPForm.tsx:123`
- All 12 existing RSVPs for Ashley's "Purge & Perk" event also have zero answers stored — meaning **every RSVP submission with custom answers has silently failed**

### Fix

**File: `src/hooks/useRSVPQuestions.ts`** — Line 93

Remove `JSON.stringify()` and pass the array directly:

```typescript
// Before (broken):
p_answers: JSON.stringify(answers),

// After (fixed):
p_answers: answers,
```

This is a one-line fix. No other files need to change.

### Note on Existing Data

The 12 existing RSVPs for Ashley's Purge & Perk event have no answers recorded. Those answers are permanently lost since they were never stored. Going forward, new RSVP submissions will correctly save custom question responses.

