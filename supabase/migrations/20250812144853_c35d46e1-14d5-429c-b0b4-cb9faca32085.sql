
-- 1) Error logs table
create table if not exists public.logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  level text not null default 'error',
  source text not null default 'newsletter-monthly',
  message text not null,
  context jsonb,
  agent_id uuid
);

alter table public.logs enable row level security;

-- Admins can manage logs
create policy if not exists "Admins can manage logs"
on public.logs
as restrictive
for all
using (get_current_user_role() = 'admin')
with check (get_current_user_role() = 'admin');

-- Admins can view logs
create policy if not exists "Admins can view logs"
on public.logs
as permissive
for select
using (get_current_user_role() = 'admin');

-- 2) Monthly runs table for idempotency
create table if not exists public.monthly_runs (
  id uuid primary key default gen_random_uuid(),
  run_type text not null, -- e.g. 'newsletter'
  report_month date not null, -- 'YYYY-MM-01'
  last_run timestamptz not null default now(),
  status text not null default 'success', -- 'success' | 'skipped' | 'error'
  details jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists monthly_runs_unique_run
  on public.monthly_runs (run_type, report_month);

alter table public.monthly_runs enable row level security;

-- Admins can manage monthly runs
create policy if not exists "Admins can manage monthly runs"
on public.monthly_runs
as restrictive
for all
using (get_current_user_role() = 'admin')
with check (get_current_user_role() = 'admin');

-- Everyone can view monthly runs (read-only)
create policy if not exists "Everyone can view monthly runs"
on public.monthly_runs
as permissive
for select
using (true);

-- 3) Requested indexes
create index if not exists idx_contacts_agent_zip
  on public.contacts (agent_id, zip_code);

create index if not exists idx_zip_reports_zip_month
  on public.zip_reports (zip_code, report_month);
