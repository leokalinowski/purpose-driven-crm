-- Recurring newsletter cadence — extends `newsletter_schedules` so an agent can
-- say "send THIS template every month on the 15th at 10am" once and have it
-- auto-fire forever until disabled. Today the table only supports one-off
-- scheduled-once sends.
--
-- Design:
--   - `recurrence` controls the frequency. 'once' is the legacy/default
--     behavior, kept for back-compat with rows already in the table.
--   - `next_send_at` is the timestamp the dispatcher cron will check. For
--     'once' it's just `scheduled_at`; for recurring it advances after each
--     send.
--   - `last_sent_at` records the last successful dispatch.
--   - `is_active` lets the agent pause without deleting the schedule.
--   - `recurrence_day` + `recurrence_hour` are the canonical cadence config
--     ("send on day-of-month X at hour Y"). For weekly/biweekly we use 0-6
--     (Sun-Sat) instead of day-of-month.
--   - `recipient_filter` already exists on the table (jsonb) and is reused
--     for audience scoping. Default {"type":"all"} = all opted-in contacts.

ALTER TABLE public.newsletter_schedules
  ADD COLUMN IF NOT EXISTS recurrence text NOT NULL DEFAULT 'once',
  ADD COLUMN IF NOT EXISTS next_send_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS recurrence_day smallint,
  ADD COLUMN IF NOT EXISTS recurrence_hour smallint NOT NULL DEFAULT 10;

-- Allowed values for recurrence. Keep the default permissive for migration
-- safety; new rows must pick one of these.
ALTER TABLE public.newsletter_schedules
  DROP CONSTRAINT IF EXISTS newsletter_schedules_recurrence_check;
ALTER TABLE public.newsletter_schedules
  ADD CONSTRAINT newsletter_schedules_recurrence_check
  CHECK (recurrence IN ('once', 'weekly', 'biweekly', 'monthly'));

-- Hour 0-23, day 1-31 for monthly OR 0-6 for weekly/biweekly. We don't
-- enforce the weekly-vs-monthly distinction in SQL — the dispatcher code
-- interprets `recurrence_day` based on `recurrence`.
ALTER TABLE public.newsletter_schedules
  DROP CONSTRAINT IF EXISTS newsletter_schedules_recurrence_hour_check;
ALTER TABLE public.newsletter_schedules
  ADD CONSTRAINT newsletter_schedules_recurrence_hour_check
  CHECK (recurrence_hour BETWEEN 0 AND 23);

ALTER TABLE public.newsletter_schedules
  DROP CONSTRAINT IF EXISTS newsletter_schedules_recurrence_day_check;
ALTER TABLE public.newsletter_schedules
  ADD CONSTRAINT newsletter_schedules_recurrence_day_check
  CHECK (recurrence_day IS NULL OR recurrence_day BETWEEN 0 AND 31);

-- Index the hot dispatch query: "find active recurring schedules ready to fire."
CREATE INDEX IF NOT EXISTS idx_newsletter_schedules_dispatch
  ON public.newsletter_schedules (next_send_at)
  WHERE is_active = true AND recurrence != 'once';

COMMENT ON COLUMN public.newsletter_schedules.recurrence IS
  'Cadence: once | weekly | biweekly | monthly. The `newsletter-recurring-dispatch` edge function picks rows where recurrence != ''once'' AND is_active = true AND next_send_at <= now().';
COMMENT ON COLUMN public.newsletter_schedules.recurrence_day IS
  'Monthly: day-of-month 1-31. Weekly/biweekly: day-of-week 0 (Sun) - 6 (Sat).';
COMMENT ON COLUMN public.newsletter_schedules.recurrence_hour IS
  'Hour-of-day 0-23 (UTC) when the schedule should fire. Frontend converts from agent local TZ.';
