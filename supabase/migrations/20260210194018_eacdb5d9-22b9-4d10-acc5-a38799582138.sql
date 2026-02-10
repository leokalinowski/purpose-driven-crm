
ALTER TABLE agent_marketing_settings
DROP COLUMN IF EXISTS metricool_user_id;

UPDATE agent_marketing_settings
SET shade_folder_id = regexp_replace(shade_folder_id, '/\d+ upload$', '/')
WHERE shade_folder_id ~ '/\d+ upload$';
