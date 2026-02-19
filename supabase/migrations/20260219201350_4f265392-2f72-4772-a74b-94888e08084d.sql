-- Fix existing clickup_tasks: set agent_id from the parent event's agent_id
UPDATE clickup_tasks ct
SET agent_id = e.agent_id
FROM events e
WHERE ct.event_id = e.id
  AND e.agent_id IS NOT NULL;