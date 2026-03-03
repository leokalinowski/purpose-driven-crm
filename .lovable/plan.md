

## Plan: Fix Email Colors, Subject Line Defaults, and Metrics Calculation

### Issue 1: Colors Not Rendering in Emails

**Root cause**: The `dataToHtml()` function in `VisualEmailEditor.tsx` bakes the color picker values directly into the HTML using JS template literals (`${pc}`, `${sc}`). These become hardcoded hex values like `#2563eb` in the saved HTML. The edge functions then look for `{primary_color}` / `{secondary_color}` placeholders to replace — but those placeholders don't exist in the saved template.

**Fix**: Change `dataToHtml()` to emit `{primary_color}` and `{secondary_color}` as template variable placeholders instead of the raw hex values. The color picker values will only be used for the in-editor preview. This way, when the edge functions (`send-event-invitation`, `rsvp-confirmation-email`, `event-reminder-email`) process the template, they'll replace `{primary_color}` with the agent's actual branding colors from `agent_marketing_settings`.

**Files**: `src/components/events/email/VisualEmailEditor.tsx` — update `dataToHtml()` to use `{primary_color}` and `{secondary_color}` placeholders in the generated HTML instead of `${pc}` / `${sc}`.

---

### Issue 2: Default Subject Line Is Wrong for Invitations

**Root cause**: `EmailTemplateEditor.tsx` line 92 hardcodes `setSubject("You're confirmed for {event_title}")` as the fallback for **all** email types when no template exists. Invitations get an RSVP confirmation subject.

**Fix**: Use a per-type subject line map (matching `DEFAULT_HEADINGS` pattern):
- `invitation`: "You're Invited to {event_title}"
- `confirmation`: "You're confirmed for {event_title}"
- `reminder_7day`: "Reminder: {event_title} is in 7 days"
- `reminder_1day`: "Reminder: {event_title} is tomorrow!"
- `thank_you`: "Thank you for attending {event_title}"
- `no_show`: "We missed you at {event_title}"

**Files**: `src/components/events/email/EmailTemplateEditor.tsx` — replace the single hardcoded subject with a type-specific lookup.

---

### Issue 3: Email Metrics Undercounting (webhook status progression)

**Root cause**: `useEmailMetrics` in `useEmailTemplates.ts` counts `total_sent` as `records.filter(e => e.status === 'sent').length`. But the Resend webhook progressively upgrades status: `sent → delivered → opened → clicked`. Once an email is delivered, it's no longer `status === 'sent'`, so it disappears from the "Total Sent" count.

Real data shows: event `9a746288` has 274 successfully sent emails but `total_sent` shows only 131 (the ones webhook hasn't updated yet).

**Fix**: Change the metrics calculation to count all successfully sent emails (status in `sent`, `delivered`, `opened`, `clicked`) as `total_sent`. Similarly, `delivered` should include `opened` and `clicked` (since those imply delivery), and `opened` should include `clicked`.

```
total_sent: records with status in [sent, delivered, opened, clicked]
delivered: records with status in [delivered, opened, clicked] OR delivered_at set
opened: records with status in [opened, clicked] OR opened_at set
clicked: records with clicked_at set
```

**Files**: `src/hooks/useEmailTemplates.ts` — fix the `useEmailMetrics` counting logic.

---

### Issue 4: 151 Stale Emails Stuck at 'sent'

The Resend webhook has **zero logs**, indicating it may not be receiving events for some emails. This is a Resend dashboard configuration issue (the webhook URL or event subscriptions may be misconfigured). No code change needed, but I'll flag this to the user.

---

### Summary of File Changes

| File | Change |
|---|---|
| `src/components/events/email/VisualEmailEditor.tsx` | `dataToHtml()`: emit `{primary_color}` / `{secondary_color}` placeholders instead of raw hex |
| `src/components/events/email/EmailTemplateEditor.tsx` | Add per-type default subject lines instead of hardcoded confirmation subject |
| `src/hooks/useEmailTemplates.ts` | Fix `useEmailMetrics` to count cumulative statuses (delivered includes opened/clicked, etc.) |

