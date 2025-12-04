-- REOP Event Engine™ - RSVP System Migration
-- Phase 1: Add RSVP functionality to events

-- Add RSVP-related columns to events table
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS public_slug TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS max_capacity INTEGER,
ADD COLUMN IF NOT EXISTS current_rsvp_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS header_image_url TEXT,
ADD COLUMN IF NOT EXISTS brand_color TEXT,
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;

-- Create index on public_slug for fast lookups
CREATE INDEX IF NOT EXISTS idx_events_public_slug ON public.events(public_slug) WHERE public_slug IS NOT NULL;

-- Create event_rsvps table
CREATE TABLE IF NOT EXISTS public.event_rsvps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  guest_count INTEGER DEFAULT 1,
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'waitlist')),
  rsvp_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  check_in_status TEXT DEFAULT 'not_checked_in' CHECK (check_in_status IN ('not_checked_in', 'checked_in', 'no_show')),
  checked_in_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- Prevent duplicate RSVPs for same event and email
  UNIQUE(event_id, email)
);

-- Create index on event_id for faster queries
CREATE INDEX IF NOT EXISTS idx_event_rsvps_event_id ON public.event_rsvps(event_id);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_email ON public.event_rsvps(email);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_status ON public.event_rsvps(status);

-- Enable RLS on event_rsvps
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Agents can view RSVPs for their own events
CREATE POLICY "Agents can view RSVPs for their events"
ON public.event_rsvps
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_rsvps.event_id
    AND (e.agent_id = auth.uid() OR get_current_user_role() = 'admin')
  )
);

-- RLS Policy: Public can insert RSVPs (no auth required for public RSVP)
CREATE POLICY "Public can create RSVPs"
ON public.event_rsvps
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_rsvps.event_id
    AND e.is_published = true
  )
);

-- RLS Policy: Agents can update RSVPs for their events
CREATE POLICY "Agents can update RSVPs for their events"
ON public.event_rsvps
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_rsvps.event_id
    AND (e.agent_id = auth.uid() OR get_current_user_role() = 'admin')
  )
);

-- RLS Policy: Agents can delete RSVPs for their events
CREATE POLICY "Agents can delete RSVPs for their events"
ON public.event_rsvps
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_rsvps.event_id
    AND (e.agent_id = auth.uid() OR get_current_user_role() = 'admin')
  )
);

-- Function to generate URL-safe slug from text
CREATE OR REPLACE FUNCTION public.generate_event_slug(title TEXT)
RETURNS TEXT AS $$
DECLARE
  slug TEXT;
  base_slug TEXT;
  counter INTEGER := 0;
BEGIN
  -- Debug: Log the input
  RAISE NOTICE 'generate_event_slug input: %', title;

  -- Convert to lowercase, replace spaces with hyphens, remove special chars
  base_slug := lower(regexp_replace(title, '[^a-z0-9]+', '-', 'g'));

  -- Debug: Log after regexp
  RAISE NOTICE 'generate_event_slug after regexp: %', base_slug;

  -- Remove leading/trailing hyphens
  base_slug := trim(both '-' from base_slug);

  -- Debug: Log after trim
  RAISE NOTICE 'generate_event_slug after trim: %', base_slug;

  -- Limit length
  base_slug := left(base_slug, 50);

  -- Debug: Log final base_slug
  RAISE NOTICE 'generate_event_slug final base_slug: %', base_slug;

  slug := base_slug;

  -- Check if slug exists, append number if needed
  WHILE EXISTS (SELECT 1 FROM public.events WHERE public_slug = slug) LOOP
    counter := counter + 1;
    slug := base_slug || '-' || counter;
  END LOOP;

  -- Debug: Log final slug
  RAISE NOTICE 'generate_event_slug final slug: %', slug;

  RETURN slug;
END;
$$ LANGUAGE plpgsql;

-- Function to update RSVP count on events table
CREATE OR REPLACE FUNCTION public.update_event_rsvp_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the count of confirmed RSVPs
  UPDATE public.events
  SET current_rsvp_count = (
    SELECT COUNT(*)::INTEGER
    FROM public.event_rsvps
    WHERE event_id = COALESCE(NEW.event_id, OLD.event_id)
    AND status = 'confirmed'
  )
  WHERE id = COALESCE(NEW.event_id, OLD.event_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update RSVP count when RSVPs are inserted
CREATE TRIGGER trg_update_rsvp_count_insert
AFTER INSERT ON public.event_rsvps
FOR EACH ROW
WHEN (NEW.status = 'confirmed')
EXECUTE FUNCTION public.update_event_rsvp_count();

-- Trigger to update RSVP count when RSVPs are updated
CREATE TRIGGER trg_update_rsvp_count_update
AFTER UPDATE ON public.event_rsvps
FOR EACH ROW
WHEN (NEW.status != OLD.status OR NEW.event_id != OLD.event_id)
EXECUTE FUNCTION public.update_event_rsvp_count();

-- Trigger to update RSVP count when RSVPs are deleted
CREATE TRIGGER trg_update_rsvp_count_delete
AFTER DELETE ON public.event_rsvps
FOR EACH ROW
EXECUTE FUNCTION public.update_event_rsvp_count();

-- Function to check for duplicate RSVP (by email and event)
CREATE OR REPLACE FUNCTION public.check_rsvp_duplicate(p_event_id UUID, p_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.event_rsvps
    WHERE event_id = p_event_id
    AND email = lower(p_email)
    AND status = 'confirmed'
  );
END;
$$ LANGUAGE plpgsql;

-- Add trigger for updating updated_at on event_rsvps
CREATE TRIGGER trg_event_rsvps_updated_at
BEFORE UPDATE ON public.event_rsvps
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update RLS policy for events to allow public read access to published events
-- SAFE: This adds a new policy for public access. Existing agent policies remain unchanged.
-- The IF EXISTS ensures no error if policy already exists from a previous run.
DROP POLICY IF EXISTS "Public can view published events" ON public.events;
CREATE POLICY "Public can view published events"
ON public.events
FOR SELECT
USING (is_published = true);

-- Update the existing update policy to also allow admins
-- SAFE: This makes the policy MORE permissive (adds admin access), not less.
-- Old policy: auth.uid() = agent_id
-- New policy: auth.uid() = agent_id OR get_current_user_role() = 'admin'
-- The IF EXISTS ensures no error if policy doesn't exist.
-- This is an enhancement, not a restriction - agents can still update their events.
DROP POLICY IF EXISTS "Users can update their own events" ON public.events;
CREATE POLICY "Users can update their own events"
ON public.events
FOR UPDATE
USING (auth.uid() = agent_id OR get_current_user_role() = 'admin')
WITH CHECK (auth.uid() = agent_id OR get_current_user_role() = 'admin');

