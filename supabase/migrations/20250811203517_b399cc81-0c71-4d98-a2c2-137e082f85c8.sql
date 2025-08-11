
-- 1) Table for monthly market stats per zip
create table if not exists public.market_stats (
  id uuid primary key default gen_random_uuid(),
  zip_code text not null,
  -- Use the first day of the month to represent the period (UTC)
  period_month date not null,
  median_sale_price numeric,
  median_list_price numeric,
  homes_sold integer,
  new_listings integer,
  median_dom integer,
  avg_price_per_sqft numeric,
  inventory integer,
  -- Raw source payload and provenance (e.g., Apify run info, actor, dataset URLs)
  source jsonb,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_market_stats_zip_period unique (zip_code, period_month)
);

-- 2) RLS
alter table public.market_stats enable row level security;

-- Everyone can read market stats
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'market_stats'
      and policyname = 'Everyone can view market stats'
  ) then
    execute 'create policy "Everyone can view market stats"
            on public.market_stats
            for select
            using (true)';
  end if;
end $$;

-- Only admins can insert/update/delete
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'market_stats'
      and policyname = 'Admins can manage market stats'
  ) then
    execute 'create policy "Admins can manage market stats"
            on public.market_stats
            for all
            using (public.get_current_user_role() = ''admin'')
            with check (public.get_current_user_role() = ''admin'')';
  end if;
end $$;

-- 3) Indexes and triggers
create index if not exists idx_market_stats_zip_month
  on public.market_stats (zip_code, period_month desc);

drop trigger if exists update_market_stats_updated_at on public.market_stats;
create trigger update_market_stats_updated_at
before update on public.market_stats
for each row execute function public.update_updated_at_column();
