# Deploy RSVP Confirmation Email Edge Function

## Option 1: Using Supabase Dashboard (Easiest)

1. **Go to your Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard/project/cguoaokqwgqvzkqqezcq/functions

2. **Create New Function**
   - Click "Create a new function"
   - Function name: `rsvp-confirmation-email`
   - Copy the entire contents of `supabase/functions/rsvp-confirmation-email/index.ts`
   - Paste into the editor

3. **Deploy**
   - Click "Deploy function"
   - Wait for deployment to complete

4. **Verify Configuration**
   - Go to Project Settings → Edge Functions
   - Make sure `rsvp-confirmation-email` is listed
   - Verify `verify_jwt = false` in config.toml (already updated)

## Option 2: Using Supabase CLI

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref cguoaokqwgqvzkqqezcq

# Deploy the function
supabase functions deploy rsvp-confirmation-email
```

## Verify Deployment

After deployment, test the function:

```bash
curl -X POST https://cguoaokqwgqvzkqqezcq.supabase.co/functions/v1/rsvp-confirmation-email \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "rsvp_id": "test-rsvp-id",
    "event_id": "test-event-id"
  }'
```

## Troubleshooting

**Error: "Function not found"**
- Make sure the function name matches exactly: `rsvp-confirmation-email`
- Check that deployment completed successfully

**Error: "Missing RESEND_API_KEY"**
- Go to Project Settings → Edge Functions → Secrets
- Add `RESEND_API_KEY` secret
- Add `RESEND_FROM_EMAIL` secret (optional, defaults to onboarding@resend.dev)
- Add `RESEND_FROM_NAME` secret (optional, defaults to "REOP Events")

**Error: "Module not found"**
- Make sure you're using the correct import URLs (matching other functions)
- The function uses the same imports as `newsletter-send` function

**Error: "Permission denied"**
- Check RLS policies on `event_rsvps` and `events` tables
- Make sure service role key has access
