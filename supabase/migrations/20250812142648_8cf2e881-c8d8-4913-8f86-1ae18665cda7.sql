
-- 1) zip_reports cache table
create table if not exists public.zip_reports (
  id uuid primary key default gen_random_uuid(),
  zip_code text not null,
  report_month date not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint zip_reports_zip_month_uniq unique (zip_code, report_month)
);

-- Ensure RLS is enabled and only admins can modify
alter table public.zip_reports enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'zip_reports' and policyname = 'Admins can manage zip reports'
  ) then
    create policy "Admins can manage zip reports"
      on public.zip_reports
      for all
      using (get_current_user_role() = 'admin')
      with check (get_current_user_role() = 'admin');
  end if;
end$$;

-- Optional: if you want to allow anyone to read cached data, uncomment below.
-- Otherwise, leave read restricted (service role bypasses RLS for cron).
-- do $$
-- begin
--   if not exists (
--     select 1 from pg_policies
--     where schemaname = 'public' and tablename = 'zip_reports' and policyname = 'Everyone can view zip reports'
--   ) then
--     create policy "Everyone can view zip reports"
--       on public.zip_reports
--       for select
--       using (true);
--   end if;
-- end$$;

-- Auto-update updated_at on change
do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.zip_reports'::regclass and tgname = 'set_updated_at'
  ) then
    create trigger set_updated_at
      before update on public.zip_reports
      for each row
      execute function public.update_updated_at_column();
  end if;
end$$;

-- 2) Enable extensions for scheduling (no-op if already enabled)
create extension if not exists pg_net;
create extension if not exists pg_cron;

-- 3) Replace existing schedule (if it exists), then create monthly run on the 5th, 14:00 UTC
do $$
declare
  jid int;
begin
  for jid in (select jobid from cron.job where jobname = 'market-report-monthly-5th') loop
    perform cron.unschedule(jid);
  end loop;
end$$;

select
  cron.schedule(
    'market-report-monthly-5th',
    '0 14 5 * *', -- 14:00 UTC on the 5th of each month
    $$
    select
      net.http_post(
        url:='https://cguoaokqwgqvzkqqezcq.functions.supabase.co/market-report-monthly',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNndW9hb2txd2dxdnprcXFlemNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0MTQ3OTEsImV4cCI6MjA2OTk5MDc5MX0.rOxOBbn4jZhCPkiCGpeNDi8_TtI8U_uZ9lvF2xvPecU"}'::jsonb,
        body:='{"trigger":"cron"}'::jsonb
      ) as request_id;
    $$
  );
