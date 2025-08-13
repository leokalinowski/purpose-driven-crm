-- Enable required extensions for scheduling HTTP calls
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Ensure idempotency: remove existing job if present
select cron.unschedule('po2-monday-emails') where exists (
  select 1 from cron.job where jobname = 'po2-monday-emails'
);

-- Schedule weekly Monday emails at 09:30 UTC (5:30 AM EDT)
select cron.schedule(
  'po2-monday-emails',
  '30 9 * * 1',
  $$
  select
    net.http_post(
      url:='https://cguoaokqwgqvzkqqezcq.supabase.co/functions/v1/po2-email-function',
      headers:='{"Content-Type":"application/json"}'::jsonb,
      body:='{"mode":"global"}'::jsonb
    ) as request_id;
  $$
);

-- Create unique index to support upsert on weekly task generation
create unique index if not exists po2_tasks_unique
on public.po2_tasks (lead_id, agent_id, task_type, week_number, year);
