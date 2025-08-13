-- Add foreign key constraint to connect po2_tasks.lead_id to contacts.id
ALTER TABLE po2_tasks 
ADD CONSTRAINT fk_po2_tasks_lead_id 
FOREIGN KEY (lead_id) REFERENCES contacts(id) ON DELETE CASCADE;