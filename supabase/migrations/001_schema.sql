-- 001 — Tables de l'app Muscu
create extension if not exists pgcrypto;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[a-zA-Z0-9_.]{3,20}$'),
  display_name text,
  share_workouts boolean not null default true,
  unit text not null default 'kg' check (unit in ('kg', 'lb')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index profiles_username_lower on public.profiles (lower(username));

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade, -- null = catalogue global
  name text not null check (length(trim(name)) between 1 and 60),
  muscle_group text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index exercises_global_name on public.exercises (lower(name)) where owner_id is null;

create table public.user_exercises (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  current_weight numeric(7,2) not null default 0 check (current_weight >= 0),
  sets int not null default 3 check (sets between 1 and 20),
  target_reps int not null default 10 check (target_reps between 1 and 100),
  increment numeric(6,2) not null default 2.5 check (increment >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, exercise_id)
);

create table public.programs (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  is_active boolean not null default false,
  share_code text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.program_days (
  id uuid primary key,
  program_id uuid not null references public.programs(id) on delete cascade,
  position int not null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.program_day_exercises (
  id uuid primary key,
  day_id uuid not null references public.program_days(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  position int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workouts (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  program_day_id uuid references public.program_days(id) on delete set null,
  name text not null default 'Séance', -- copie du nom du jour, conservée si le programme change
  started_at timestamptz not null,
  finished_at timestamptz,
  status text not null check (status in ('in_progress', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workouts_user_finished on public.workouts (user_id, finished_at desc);

create table public.workout_sets (
  id uuid primary key,
  workout_id uuid not null references public.workouts(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  position int not null,
  target_reps int not null,
  reps int not null check (reps >= 0),
  weight numeric(7,2) not null check (weight >= 0),
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workout_sets_workout on public.workout_sets (workout_id);

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  check (requester_id <> addressee_id)
);
create unique index friendships_pair on public.friendships
  (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

create table public.reactions (
  workout_id uuid not null references public.workouts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (workout_id, user_id)
);

-- Profil créé automatiquement à l'inscription, avec un pseudo provisoire « user_xxxxxxxx ».
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, username) values (new.id, 'user_' || left(replace(new.id::text, '-', ''), 8));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
