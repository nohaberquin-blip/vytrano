-- 007 — Fiche personnelle (sexe, naissance, taille, activité, séances, objectif, réglages)
-- et pesées. Privé : chaque utilisateur ne voit et n'écrit que ses lignes.

create table if not exists public.body_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  user_id uuid not null unique references auth.users(id) on delete cascade check (user_id = id),
  sex text check (sex in ('male', 'female', 'unspecified')),
  birth_date date check (birth_date > '1900-01-01'),
  height_cm numeric(4,1) check (height_cm between 120 and 230),
  activity text check (activity in ('sedentary', 'light', 'active', 'very_active')),
  sessions_per_week smallint check (sessions_per_week between 0 and 14),
  goal text check (goal in ('bulk', 'cut', 'maintain', 'recomp', 'strength')),
  kcal_override int check (kcal_override between 1000 and 6000),
  protein_per_kg numeric(2,1) check (protein_per_kg between 1.0 and 3.0),
  fat_pct smallint check (fat_pct between 15 and 40),
  updated_at timestamptz not null default now()
);

create table if not exists public.weight_entries (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  weight_kg numeric(5,2) not null check (weight_kg between 30 and 300),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table public.body_profiles enable row level security;
alter table public.weight_entries enable row level security;

drop policy if exists body_profiles_own on public.body_profiles;
create policy body_profiles_own on public.body_profiles for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists weight_entries_own on public.weight_entries;
create policy weight_entries_own on public.weight_entries for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
