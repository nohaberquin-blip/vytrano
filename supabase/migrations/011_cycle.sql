-- 011 — Mon cycle : règles notées (privées) et séance allégée.

create table if not exists public.periods (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  start date not null,
  days smallint not null check (days between 2 and 10),
  updated_at timestamptz not null default now(),
  unique (user_id, start)
);

alter table public.periods enable row level security;
drop policy if exists periods_own on public.periods;
create policy periods_own on public.periods for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.workouts
  add column if not exists lightened text check (lightened in ('minus10', 'minus20', 'fewer'));
