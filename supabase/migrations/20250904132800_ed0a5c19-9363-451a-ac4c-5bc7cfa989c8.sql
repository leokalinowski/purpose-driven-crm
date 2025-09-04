-- Phase 1: Create newsletter settings for current user (Leo)
INSERT INTO newsletter_settings (agent_id, enabled, schedule_day, schedule_hour)
VALUES ('91898990-5047-41b8-b977-bc8337a3569b', true, 1, 9)
ON CONFLICT (agent_id) DO UPDATE SET
  enabled = EXCLUDED.enabled,
  schedule_day = EXCLUDED.schedule_day,
  schedule_hour = EXCLUDED.schedule_hour,
  updated_at = now();

-- Phase 3: Add sample contacts with ZIP codes for testing
INSERT INTO contacts (agent_id, first_name, last_name, email, zip_code, category)
VALUES 
  ('91898990-5047-41b8-b977-bc8337a3569b', 'John', 'Smith', 'john.smith@example.com', '90210', 'S'),
  ('91898990-5047-41b8-b977-bc8337a3569b', 'Jane', 'Doe', 'jane.doe@example.com', '90210', 'D'),
  ('91898990-5047-41b8-b977-bc8337a3569b', 'Bob', 'Johnson', 'bob.johnson@example.com', '10001', 'J'),
  ('91898990-5047-41b8-b977-bc8337a3569b', 'Alice', 'Williams', 'alice.williams@example.com', '10001', 'W'),
  ('91898990-5047-41b8-b977-bc8337a3569b', 'Charlie', 'Brown', 'charlie.brown@example.com', '33101', 'B')
ON CONFLICT (agent_id, email) DO NOTHING;