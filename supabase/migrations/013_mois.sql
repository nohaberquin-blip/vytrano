-- 013 — Le mois : défis personnels et objectifs de séances par mois (privés).

create table if not exists public.challenges (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('month', 'sessions', 'lift')),
  exercise_id uuid references public.exercises(id) on delete cascade,
  metric text check (metric in ('weight', 'e1rm')),
  target numeric(6,2) not null check (target between 0 and 999),
  start date not null,
  end_date date not null check (end_date >= start),
  updated_at timestamptz not null default now(),
  -- Un défi de charge vise un exercice et une mesure ; les autres non.
  check ((kind = 'lift') = (exercise_id is not null and metric is not null))
);

alter table public.challenges enable row level security;
drop policy if exists challenges_own on public.challenges;
create policy challenges_own on public.challenges for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
