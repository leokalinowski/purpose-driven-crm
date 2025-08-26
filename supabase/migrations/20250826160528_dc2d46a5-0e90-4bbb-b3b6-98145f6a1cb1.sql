-- Rename po2_tasks table to spheresync_tasks
ALTER TABLE po2_tasks RENAME TO spheresync_tasks;

-- Update any indexes that might reference the old table name
-- Note: Postgres automatically renames indexes when table is renamed, but let's be explicit about any custom ones
-- The existing RLS policies will automatically apply to the renamed table

-- Add comment to document the table purpose
COMMENT ON TABLE spheresync_tasks IS 'SphereSync task management system for balanced contact assignment distribution based on surname frequency analysis';