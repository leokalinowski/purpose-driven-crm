
-- Create announcements table
CREATE TABLE public.announcements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  content text NOT NULL,
  type text NOT NULL DEFAULT 'feature',
  image_url text,
  action_url text,
  action_label text,
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 0,
  target_role text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_by uuid NOT NULL
);

-- Create announcement_dismissals table
CREATE TABLE public.announcement_dismissals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(announcement_id, user_id)
);

-- Enable RLS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_dismissals ENABLE ROW LEVEL SECURITY;

-- Announcements policies
CREATE POLICY "Authenticated users can view active announcements"
  ON public.announcements FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage announcements"
  ON public.announcements FOR ALL
  USING (get_current_user_role() = 'admin')
  WITH CHECK (get_current_user_role() = 'admin');

-- Dismissals policies
CREATE POLICY "Users can view their own dismissals"
  ON public.announcement_dismissals FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own dismissals"
  ON public.announcement_dismissals FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all dismissals"
  ON public.announcement_dismissals FOR SELECT
  USING (get_current_user_role() = 'admin');
