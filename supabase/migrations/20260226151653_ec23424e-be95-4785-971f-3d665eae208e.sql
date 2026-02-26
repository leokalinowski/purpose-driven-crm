ALTER TABLE announcements
  ADD COLUMN display_position text NOT NULL DEFAULT 'center',
  ADD COLUMN display_style text NOT NULL DEFAULT 'modal';