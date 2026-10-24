-- 006 — Calendrier : jours d'entraînement, exceptions par date, objectifs par semaine.
-- Privé : chaque utilisateur ne voit et n'écrit que ses lignes.

create table if not exists public.training_schedules (
  id uuid primary key references auth.users(id) on delete cascade,
  user_id uuid not null unique references auth.users(id) on delete cascade check (user_id = id),
  weekdays smallint[] not null default '{}' check (weekdays <@ array[1,2,3,4,5,6,7]::smallint[]),
  since date not null default current_date,
  updated_at timestamptz not null default now()
);

create table if not exists public.schedule_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  kind text not null check (kind in ('train', 'rest')),
  moved_to date check (moved_to is null or (kind = 'rest' and moved_to <> date)),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create table if not exists public.weekly_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  sessions smallint not null check (sessions between 0 and 14),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);

alter table public.training_schedules enable row level security;
alter table public.schedule_overrides enable row level security;
alter table public.weekly_goals enable row level security;

drop policy if exists training_schedules_own on public.training_schedules;
create policy training_schedules_own on public.training_schedules for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists schedule_overrides_own on public.schedule_overrides;
create policy schedule_overrides_own on public.schedule_overrides for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists weekly_goals_own on public.weekly_goals;
create policy weekly_goals_own on public.weekly_goals for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
