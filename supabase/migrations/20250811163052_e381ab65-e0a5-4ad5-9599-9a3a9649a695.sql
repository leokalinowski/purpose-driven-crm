-- Enable required extensions for scheduling and HTTP
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Create automation_settings table
create table if not exists public.automation_settings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  enabled boolean not null default true,
  apify_max_results integer not null default 10,
  prompt_template text
);

-- Ensure updated_at trigger exists for automation_settings
-- (update_updated_at_column function already exists in this project)
drop trigger if exists update_automation_settings_updated_at on public.automation_settings;
create trigger update_automation_settings_updated_at
before update on public.automation_settings
for each row execute function public.update_updated_at_column();

-- RLS for automation_settings
alter table public.automation_settings enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'automation_settings' and policyname = 'Admins can manage automation settings'
  ) then
    create policy "Admins can manage automation settings"
    on public.automation_settings
    for all
    using (public.get_current_user_role() = 'admin')
    with check (public.get_current_user_role() = 'admin');
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'automation_settings' and policyname = 'Everyone can view automation settings'
  ) then
    create policy "Everyone can view automation settings"
    on public.automation_settings
    for select
    using (true);
  end if;
end $$;

-- Create automation_runs table
create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  triggered_by uuid,
  status text not null default 'running',
  dry_run boolean not null default false,
  test_zip text,
  emails_sent integer not null default 0,
  zip_codes_processed integer not null default 0,
  error text
);

-- RLS for automation_runs
alter table public.automation_runs enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'automation_runs' and policyname = 'Admins can manage automation runs'
  ) then
    create policy "Admins can manage automation runs"
    on public.automation_runs
    for all
    using (public.get_current_user_role() = 'admin')
    with check (public.get_current_user_role() = 'admin');
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'automation_runs' and policyname = 'Everyone can view automation runs'
  ) then
    create policy "Everyone can view automation runs"
    on public.automation_runs
    for select
    using (true);
  end if;
end $$;

-- Schedule monthly job via pg_cron to invoke the edge function
-- Remove any existing job with the same name to avoid duplicates
-- (cron.job table is provided by pg_cron extension)
call (
  select null::void
  from (
    delete from cron.job where jobname = 'monthly-zip-trends'
    returning 1
  ) as t
);

select cron.schedule(
  'monthly-zip-trends',              -- job name
  '0 0 1 * *',                       -- run at 00:00 UTC on the 1st of every month
  $$
  select
    net.http_post(
      url := 'https://cguoaokqwgqvzkqqezcq.supabase.co/functions/v1/monthly-zip-trends',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNndW9hb2txd2dxdnprcXFlemNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0MTQ3OTEsImV4cCI6MjA2OTk5MDc5MX0.rOxOBbn4jZhCPkiCGpeNDi8_TtI8U_uZ9lvF2xvPecU"}'::jsonb,
      body := jsonb_build_object('source', 'pg_cron', 'scheduled_at', now())
    );
  $$
);
