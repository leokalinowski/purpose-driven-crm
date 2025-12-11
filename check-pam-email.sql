-- Quick SQL queries to diagnose Pam O'Bryant's email issues
-- Run these in Supabase SQL Editor

-- 1. Find Pam's profile and check email
SELECT 
  user_id,
  first_name,
  last_name,
  email,
  role,
  created_at,
  updated_at,
  CASE 
    WHEN email IS NULL OR email = '' THEN '❌ NO EMAIL ADDRESS'
    ELSE '✅ Has email'
  END as email_status
FROM profiles
WHERE first_name ILIKE '%Pam%' 
   OR last_name ILIKE '%O''Bryant%'
   OR last_name ILIKE '%OBryant%'
   OR last_name ILIKE '%Bryant%';

-- 2. Check current week number (for reference)
-- Note: This is a simplified calculation - the actual function uses ISO 8601
SELECT 
  EXTRACT(WEEK FROM CURRENT_DATE)::integer as current_week_simple,
  EXTRACT(YEAR FROM CURRENT_DATE)::integer as current_year;

-- 3. Check Pam's tasks for current week
-- Replace 'PAM_USER_ID' with the actual user_id from query #1
WITH pam_profile AS (
  SELECT user_id
  FROM profiles
  WHERE first_name ILIKE '%Pam%' 
     OR last_name ILIKE '%O''Bryant%'
     OR last_name ILIKE '%OBryant%'
  LIMIT 1
),
current_week_info AS (
  SELECT 
    EXTRACT(WEEK FROM CURRENT_DATE)::integer as week_num,
    EXTRACT(YEAR FROM CURRENT_DATE)::integer as year_num
)
SELECT 
  st.week_number,
  st.year,
  COUNT(*) as total_tasks,
  COUNT(*) FILTER (WHERE st.task_type = 'call') as call_tasks,
  COUNT(*) FILTER (WHERE st.task_type = 'text') as text_tasks,
  COUNT(*) FILTER (WHERE st.completed = true) as completed_tasks,
  COUNT(*) FILTER (WHERE st.completed = false) as pending_tasks,
  CASE 
    WHEN COUNT(*) = 0 THEN '❌ NO TASKS - Will not receive SphereSync email'
    ELSE '✅ Has tasks'
  END as task_status
FROM spheresync_tasks st
CROSS JOIN pam_profile pp
CROSS JOIN current_week_info cw
WHERE st.agent_id = pp.user_id
  AND st.week_number = cw.week_num
  AND st.year = cw.year_num
GROUP BY st.week_number, st.year;

-- 4. Check email logs for Pam
WITH pam_profile AS (
  SELECT user_id
  FROM profiles
  WHERE first_name ILIKE '%Pam%' 
     OR last_name ILIKE '%O''Bryant%'
     OR last_name ILIKE '%OBryant%'
  LIMIT 1
)
SELECT 
  sel.week_number,
  sel.year,
  sel.sent_at,
  sel.task_count,
  CASE 
    WHEN sel.sent_at IS NOT NULL THEN '✅ Email was sent'
    ELSE '❌ No email sent'
  END as email_status
FROM spheresync_email_logs sel
CROSS JOIN pam_profile pp
WHERE sel.agent_id = pp.user_id
ORDER BY sel.sent_at DESC
LIMIT 10;

-- 5. Check if email was sent for current week
WITH pam_profile AS (
  SELECT user_id
  FROM profiles
  WHERE first_name ILIKE '%Pam%' 
     OR last_name ILIKE '%O''Bryant%'
     OR last_name ILIKE '%OBryant%'
  LIMIT 1
),
current_week_info AS (
  SELECT 
    EXTRACT(WEEK FROM CURRENT_DATE)::integer as week_num,
    EXTRACT(YEAR FROM CURRENT_DATE)::integer as year_num
)
SELECT 
  CASE 
    WHEN sel.id IS NOT NULL THEN '✅ Email was sent for current week'
    ELSE '❌ Email NOT sent for current week'
  END as current_week_email_status,
  sel.sent_at,
  sel.task_count
FROM pam_profile pp
CROSS JOIN current_week_info cw
LEFT JOIN spheresync_email_logs sel 
  ON sel.agent_id = pp.user_id 
  AND sel.week_number = cw.week_num 
  AND sel.year = cw.year_num;

-- 6. Check Pam's contacts (to understand why she might not have tasks)
WITH pam_profile AS (
  SELECT user_id
  FROM profiles
  WHERE first_name ILIKE '%Pam%' 
     OR last_name ILIKE '%O''Bryant%'
     OR last_name ILIKE '%OBryant%'
  LIMIT 1
)
SELECT 
  COUNT(*) as total_contacts,
  COUNT(DISTINCT category) as unique_categories,
  COUNT(*) FILTER (WHERE dnc = true) as dnc_count,
  COUNT(*) FILTER (WHERE dnc = false) as active_contacts,
  STRING_AGG(DISTINCT category, ', ' ORDER BY category) as categories
FROM contacts
WHERE agent_id = (SELECT user_id FROM pam_profile);

-- 7. Check recent tasks across all weeks (to see if Pam ever gets tasks)
WITH pam_profile AS (
  SELECT user_id
  FROM profiles
  WHERE first_name ILIKE '%Pam%' 
     OR last_name ILIKE '%O''Bryant%'
     OR last_name ILIKE '%OBryant%'
  LIMIT 1
)
SELECT 
  week_number,
  year,
  COUNT(*) as task_count,
  COUNT(*) FILTER (WHERE completed = true) as completed,
  MIN(created_at) as first_task_date,
  MAX(created_at) as last_task_date
FROM spheresync_tasks
WHERE agent_id = (SELECT user_id FROM pam_profile)
GROUP BY week_number, year
ORDER BY year DESC, week_number DESC
LIMIT 10;

-- 8. Summary query - All info in one place
WITH pam_profile AS (
  SELECT 
    user_id,
    first_name,
    last_name,
    email,
    role
  FROM profiles
  WHERE first_name ILIKE '%Pam%' 
     OR last_name ILIKE '%O''Bryant%'
     OR last_name ILIKE '%OBryant%'
  LIMIT 1
),
current_week_info AS (
  SELECT 
    EXTRACT(WEEK FROM CURRENT_DATE)::integer as week_num,
    EXTRACT(YEAR FROM CURRENT_DATE)::integer as year_num
),
task_summary AS (
  SELECT 
    COUNT(*) as current_week_tasks
  FROM spheresync_tasks st
  CROSS JOIN pam_profile pp
  CROSS JOIN current_week_info cw
  WHERE st.agent_id = pp.user_id
    AND st.week_number = cw.week_num
    AND st.year = cw.year_num
),
email_log_summary AS (
  SELECT 
    COUNT(*) > 0 as email_sent_this_week
  FROM spheresync_email_logs sel
  CROSS JOIN pam_profile pp
  CROSS JOIN current_week_info cw
  WHERE sel.agent_id = pp.user_id
    AND sel.week_number = cw.week_num
    AND sel.year = cw.year_num
),
contact_summary AS (
  SELECT 
    COUNT(*) as total_contacts
  FROM contacts
  WHERE agent_id = (SELECT user_id FROM pam_profile)
)
SELECT 
  pp.first_name || ' ' || pp.last_name as name,
  pp.email,
  CASE 
    WHEN pp.email IS NULL OR pp.email = '' THEN '❌ MISSING EMAIL'
    ELSE '✅ Has email'
  END as email_status,
  COALESCE(ts.current_week_tasks, 0) as current_week_tasks,
  CASE 
    WHEN COALESCE(ts.current_week_tasks, 0) = 0 THEN '❌ NO TASKS - Will not receive email'
    ELSE '✅ Has tasks'
  END as task_status,
  CASE 
    WHEN els.email_sent_this_week THEN '✅ Email sent this week'
    ELSE '❌ Email not sent this week'
  END as email_sent_status,
  cs.total_contacts as total_contacts,
  CASE 
    WHEN pp.email IS NULL OR pp.email = '' THEN 'Fix: Add email address to profile'
    WHEN COALESCE(ts.current_week_tasks, 0) = 0 THEN 'Fix: Ensure Pam has contacts matching current week categories'
    WHEN NOT els.email_sent_this_week AND COALESCE(ts.current_week_tasks, 0) > 0 THEN 'Fix: Email function may not have run or failed'
    ELSE '✅ Everything looks good'
  END as recommendation
FROM pam_profile pp
CROSS JOIN current_week_info cw
LEFT JOIN task_summary ts ON true
LEFT JOIN email_log_summary els ON true
LEFT JOIN contact_summary cs ON true;

