

# Change Newsletter Sending Subdomain to news.realestateonpurpose.com

## What's Involved

The newsletter system uses a Supabase secret `RESEND_FROM_EMAIL` for the actual sending address — no domain is hardcoded in the edge function code. The only hardcoded reference to `market.realestateonpurpose.com` is a UI label in `SendSchedulePanel.tsx`.

So this is primarily a **configuration change** with one small code update.

## Steps

### 1. DNS & Resend Setup (you need to do this)
- Go to [Resend Domains](https://resend.com/domains) and add `news.realestateonpurpose.com` as a new sending domain.
- Add the required DNS records (MX, TXT/DKIM, SPF) at your domain registrar for the `news` subdomain.
- Wait for verification to complete in Resend.

### 2. Update the Supabase Secret
- Update the `RESEND_FROM_EMAIL` secret value from the current `market.realestateonpurpose.com` address to the new `news.realestateonpurpose.com` address (e.g., `noreply@news.realestateonpurpose.com`).

### 3. Code Change (one line)
Update the UI label in `SendSchedulePanel.tsx` line 173:

| File | Change |
|------|--------|
| `SendSchedulePanel.tsx` | Change `"Sent from market.realestateonpurpose.com"` to `"Sent from news.realestateonpurpose.com"` |

No edge function changes needed — both `newsletter-send` and `newsletter-template-send` read the from address from the `RESEND_FROM_EMAIL` environment variable.

