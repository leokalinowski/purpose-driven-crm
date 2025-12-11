-- Drop and recreate email_type check constraint with additional values
ALTER TABLE email_logs DROP CONSTRAINT IF EXISTS email_logs_email_type_check;
ALTER TABLE email_logs ADD CONSTRAINT email_logs_email_type_check 
CHECK (email_type = ANY (ARRAY[
  'spheresync_reminder', 'spheresync_weekly', 'success_scoreboard_reminder',
  'event_confirmation', 'event_reminder', 'event_reminder_7day', 'event_reminder_1day', 
  'event_thank_you', 'event_no_show', 'newsletter', 'team_invitation', 
  'dnc_report', 'general', 'other'
]));

-- Drop and recreate status check constraint with additional values
ALTER TABLE email_logs DROP CONSTRAINT IF EXISTS email_logs_status_check;
ALTER TABLE email_logs ADD CONSTRAINT email_logs_status_check 
CHECK (status = ANY (ARRAY[
  'pending', 'sent', 'delivered', 'opened', 'clicked', 
  'failed', 'bounced', 'complained', 'unsubscribed'
]));