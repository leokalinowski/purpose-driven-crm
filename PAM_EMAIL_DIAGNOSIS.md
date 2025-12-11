# Pam O'Bryant Email Diagnosis Guide

## How Email Systems Work

### 1. SphereSync Emails
**Function**: `supabase/functions/spheresync-email-function/index.ts`

**How it works**:
1. Fetches all SphereSync tasks for the current week
2. Gets unique `agent_id` values from those tasks
3. Queries `profiles` table to get email addresses for those agents
4. Sends emails ONLY to agents who:
   - Have tasks assigned for the current week
   - Have an email address in their profile
   - Haven't already received an email this week (checked via `spheresync_email_logs`)

**Key Point**: If Pam doesn't have tasks for the current week, she won't receive SphereSync emails.

### 2. Other Email Systems
- **Coaching Reminders**: Sent to agents who haven't submitted coaching forms
- **Newsletter**: Sent to contacts, not agents
- **Communication**: Uses the `send-email` function

## Common Reasons Pam Might Not Receive Emails

### Issue 1: Missing Email Address
**Symptom**: Profile exists but `email` field is NULL or empty

**Check**:
```sql
SELECT user_id, first_name, last_name, email 
FROM profiles 
WHERE first_name ILIKE '%Pam%' 
   OR last_name ILIKE '%O''Bryant%' 
   OR last_name ILIKE '%OBryant%';
```

**Fix**: Update the profile with Pam's email address

### Issue 2: No Tasks Assigned
**Symptom**: Pam has no SphereSync tasks for the current week

**Check**:
```sql
-- Get current week number (you'll need to calculate this)
-- Then check:
SELECT COUNT(*) as task_count
FROM spheresync_tasks
WHERE agent_id = 'PAM_USER_ID'
  AND week_number = CURRENT_WEEK
  AND year = CURRENT_YEAR;
```

**Fix**: Ensure Pam has contacts that match the current week's letter categories

### Issue 3: Email Already Sent
**Symptom**: Email was sent but Pam didn't receive it (delivery issue)

**Check**:
```sql
SELECT * 
FROM spheresync_email_logs
WHERE agent_id = 'PAM_USER_ID'
ORDER BY sent_at DESC
LIMIT 10;
```

**Fix**: Check Resend logs or email delivery status

### Issue 4: Email Sending Failed
**Symptom**: Error in email function logs

**Check**: Look at Supabase function logs for `spheresync-email-function`

**Fix**: Check Resend API key and email configuration

## Quick Diagnostic Queries

### Find Pam's Profile
```sql
SELECT 
  user_id,
  first_name,
  last_name,
  email,
  role,
  created_at
FROM profiles
WHERE first_name ILIKE '%Pam%' 
   OR last_name ILIKE '%O''Bryant%'
   OR last_name ILIKE '%OBryant%';
```

### Check Pam's Current Week Tasks
```sql
-- Replace PAM_USER_ID with actual user_id from above query
SELECT 
  COUNT(*) as total_tasks,
  COUNT(*) FILTER (WHERE task_type = 'call') as call_tasks,
  COUNT(*) FILTER (WHERE task_type = 'text') as text_tasks,
  COUNT(*) FILTER (WHERE completed = true) as completed_tasks
FROM spheresync_tasks
WHERE agent_id = 'PAM_USER_ID'
  AND week_number = (
    -- Calculate current week (simplified)
    SELECT EXTRACT(WEEK FROM CURRENT_DATE)::integer
  )
  AND year = EXTRACT(YEAR FROM CURRENT_DATE)::integer;
```

### Check Email Logs
```sql
SELECT 
  week_number,
  year,
  sent_at,
  task_count
FROM spheresync_email_logs
WHERE agent_id = 'PAM_USER_ID'
ORDER BY sent_at DESC
LIMIT 10;
```

### Check Contacts
```sql
SELECT 
  COUNT(*) as total_contacts,
  COUNT(DISTINCT category) as unique_categories,
  COUNT(*) FILTER (WHERE dnc = true) as dnc_count
FROM contacts
WHERE agent_id = 'PAM_USER_ID';
```

## Running the Diagnostic Script

1. Set environment variables:
```bash
export SUPABASE_URL="your-supabase-url"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

2. Run the diagnostic:
```bash
deno run --allow-net --allow-env diagnose-pam-email.ts
```

## Manual Fixes

### Fix 1: Add/Update Email Address
```sql
UPDATE profiles
SET email = 'pam.email@example.com'
WHERE user_id = 'PAM_USER_ID';
```

### Fix 2: Force Send Email (Test)
Call the SphereSync email function with test mode:
```bash
curl -X POST https://YOUR_SUPABASE_URL/functions/v1/spheresync-email-function \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "testEmail": "pam.email@example.com",
    "force": true
  }'
```

### Fix 3: Generate Tasks for Pam
If Pam has contacts but no tasks, ensure task generation ran:
- Check if contacts match current week's categories
- Manually trigger task generation if needed

## Next Steps

1. Run the diagnostic script to identify the specific issue
2. Check Pam's profile for email address
3. Verify Pam has tasks assigned
4. Check email logs to see if emails were attempted
5. Review Resend delivery logs if emails were sent but not received

