-- Fix stuck newsletter runs that are in 'running' state
-- These are likely from interrupted executions and should be marked as failed

UPDATE monthly_runs 
SET status = 'failed', 
    error = 'Process interrupted - marked as failed during system cleanup',
    finished_at = updated_at
WHERE status = 'running' 
  AND created_at < NOW() - INTERVAL '2 hours';

-- Add some sample newsletter campaigns for testing analytics
-- (These will be replaced by real campaigns as the system is used)

INSERT INTO newsletter_campaigns (campaign_name, created_by, send_date, recipient_count, open_rate, click_through_rate, status)
SELECT 
  'Sample Market Newsletter - ' || p.first_name || ' ' || p.last_name,
  p.user_id,
  DATE(mr.created_at),
  mr.emails_sent,
  CASE WHEN mr.emails_sent > 0 THEN ROUND(15 + (RANDOM() * 20)::numeric, 2) ELSE NULL END,
  CASE WHEN mr.emails_sent > 0 THEN ROUND(2 + (RANDOM() * 8)::numeric, 2) ELSE NULL END,
  CASE mr.status 
    WHEN 'completed' THEN 'sent'
    WHEN 'success' THEN 'sent'
    WHEN 'failed' THEN 'failed'
    WHEN 'error' THEN 'failed'
    ELSE 'draft'
  END
FROM monthly_runs mr
JOIN profiles p ON mr.agent_id = p.user_id
WHERE mr.emails_sent > 0
  AND NOT EXISTS (
    SELECT 1 FROM newsletter_campaigns nc 
    WHERE nc.created_by = mr.agent_id 
    AND nc.send_date = DATE(mr.created_at)
  )
LIMIT 20;