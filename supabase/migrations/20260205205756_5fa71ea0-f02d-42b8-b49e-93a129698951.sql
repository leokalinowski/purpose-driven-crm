-- First, drop the existing check constraint
ALTER TABLE support_config DROP CONSTRAINT IF EXISTS support_config_category_check;

-- Add the updated check constraint that includes 'coaching'
ALTER TABLE support_config ADD CONSTRAINT support_config_category_check 
CHECK (category IN ('database', 'social', 'events', 'newsletter', 'spheresync', 'technical', 'general', 'coaching'));

-- Update existing categories with correct assignees and ClickUp IDs
UPDATE support_config SET assignee_name = 'Leonardo', clickup_assignee_id = '90173434' WHERE category = 'database';
UPDATE support_config SET assignee_name = 'Leonardo', clickup_assignee_id = '90173434' WHERE category = 'newsletter';
UPDATE support_config SET assignee_name = 'Leonardo', clickup_assignee_id = '90173434' WHERE category = 'spheresync';
UPDATE support_config SET assignee_name = 'Leonardo', clickup_assignee_id = '90173434' WHERE category = 'technical';
UPDATE support_config SET assignee_name = 'JJ Gagliardi', clickup_assignee_id = '4478890' WHERE category = 'social';
UPDATE support_config SET assignee_name = 'Kate Atkinson', clickup_assignee_id = '87391446' WHERE category = 'events';
UPDATE support_config SET assignee_name = 'Kate Atkinson', clickup_assignee_id = '87391446' WHERE category = 'general';

-- Add new coaching category assigned to Pam
INSERT INTO support_config (category, assignee_name, clickup_assignee_id)
VALUES ('coaching', 'Pam O''Bryant', '81570896')
ON CONFLICT (category) DO UPDATE SET 
  assignee_name = EXCLUDED.assignee_name,
  clickup_assignee_id = EXCLUDED.clickup_assignee_id;