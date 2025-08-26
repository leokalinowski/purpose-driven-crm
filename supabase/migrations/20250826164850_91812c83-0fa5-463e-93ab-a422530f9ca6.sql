-- Clear existing SphereSync tasks for current week to force regeneration with new logic
DELETE FROM spheresync_tasks 
WHERE week_number = EXTRACT(week FROM NOW()) 
AND year = EXTRACT(year FROM NOW());