-- Change event_date column from DATE to TIMESTAMP WITH TIME ZONE to support time storage
-- This allows events to have specific times, not just dates

ALTER TABLE public.events
ALTER COLUMN event_date TYPE TIMESTAMP WITH TIME ZONE
USING event_date::timestamp with time zone;

-- Add a comment for documentation
COMMENT ON COLUMN public.events.event_date IS 'Event date and time with timezone support';
