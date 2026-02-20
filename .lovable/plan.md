

# Remove Hardcoded Email Fallback Templates

## Problem

All three event email Edge Functions have a 3-tier template resolution chain:
1. Event-specific template (from `event_email_templates`)
2. Global template (from `global_email_templates`)
3. **Hardcoded HTML fallback** -- this is the problem

When tiers 1 and 2 fail silently (e.g., a query returns no rows), the system falls back to old, unstyled hardcoded HTML with wrong headings. This makes event emails unreliable because you never know if your customized template is actually being used.

## Solution

Remove the hardcoded fallback from all three functions. If no saved template is found (event-specific or global), the function will **skip sending** and return a clear error message explaining that a template is missing. This makes failures visible instead of silent.

## Changes

### 1. `supabase/functions/send-event-invitation/index.ts`
- **Remove** the entire hardcoded fallback HTML block (lines 194-254, the `else` clause after global template check)
- **Add** an error response if no template is found:
  ```
  "No invitation template found for this event. Please create one in the Email Templates editor."
  ```
- This is ~60 lines of hardcoded HTML removed

### 2. `supabase/functions/event-email-scheduler/index.ts`
- **Remove** the hardcoded fallback from the `resolveTemplate` function (lines 123-148)
- **Return `null`** when no template is found instead of hardcoded HTML
- **Skip sending** for that email type and log it in the summary as `no_template` instead of silently using wrong content

### 3. `supabase/functions/rsvp-confirmation-email/index.ts`
- **Remove** the hardcoded fallback HTML block (the large `if (!emailHtml)` section, approximately lines 166-218)
- **Return an error** if no confirmation template is found:
  ```
  "No confirmation template found for this event. Please create one in the Email Templates editor."
  ```

### What stays

- Event-specific template lookup (tier 1) -- unchanged
- Global template lookup (tier 2) -- unchanged
- Variable replacement logic -- unchanged
- All agent branding, date formatting, sender identity logic -- unchanged

### Behavior after this change

| Scenario | Before | After |
|---|---|---|
| Event-specific template exists | Uses it | Uses it (no change) |
| Only global template exists | Uses it | Uses it (no change) |
| No template at all | Silently uses ugly hardcoded HTML | Returns error, email not sent |

## Files Modified

| File | Change |
|---|---|
| `supabase/functions/send-event-invitation/index.ts` | Remove hardcoded fallback, add error when no template found |
| `supabase/functions/event-email-scheduler/index.ts` | Remove hardcoded fallback from `resolveTemplate`, skip + log when missing |
| `supabase/functions/rsvp-confirmation-email/index.ts` | Remove hardcoded fallback, add error when no template found |

All three functions will be redeployed after changes.
