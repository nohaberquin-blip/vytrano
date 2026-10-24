-- 011 — Mon cycle : règles notées et séances allégées, toutes deux privées.

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

-- Séance allégée : table privée à part, car les amis peuvent lire la table workouts
-- (une colonne « allégée » laisserait deviner les dates des règles).
create table if not exists public.workout_lightenings (
  id uuid primary key references public.workouts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('minus10', 'minus20', 'fewer')),
  updated_at timestamptz not null default now()
);

alter table public.workout_lightenings enable row level security;
drop policy if exists workout_lightenings_own on public.workout_lightenings;
create policy workout_lightenings_own on public.workout_lightenings for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
