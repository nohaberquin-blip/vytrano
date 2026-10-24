-- Installation complète de Vytrano : à coller en une fois dans SQL Editor → New query → Run.
-- Généré à partir de supabase/migrations/001→008 et supabase/seed_exercises.sql (009 se colle à part, voir docs/SETUP.md).

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

-- 002 — Règles d'accès (Row Level Security)

create function public.is_friend(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from friendships f
    where f.status = 'accepted'
      and ((f.requester_id = a and f.addressee_id = b) or (f.requester_id = b and f.addressee_id = a))
  )
$$;

-- Les séances de `owner` sont visibles par lui-même, ou par ses amis s'il partage.
create function public.can_see_workouts(owner uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select owner = auth.uid()
    or (public.is_friend(auth.uid(), owner)
        and exists (select 1 from profiles p where p.user_id = owner and p.share_workouts))
$$;

alter table public.profiles enable row level security;
alter table public.exercises enable row level security;
alter table public.user_exercises enable row level security;
alter table public.programs enable row level security;
alter table public.program_days enable row level security;
alter table public.program_day_exercises enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_sets enable row level security;
alter table public.friendships enable row level security;
alter table public.reactions enable row level security;

-- profiles : lisibles par tous les connectés (recherche), modifiables par soi.
create policy profiles_read on public.profiles for select to authenticated using (true);
create policy profiles_update on public.profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- exercises : noms lisibles par tous (pour afficher les séances des amis), écriture des siens.
create policy exercises_read on public.exercises for select to authenticated using (true);
create policy exercises_write on public.exercises for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Fiches et programmes : propriétaire uniquement.
create policy user_exercises_own on public.user_exercises for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy programs_own on public.programs for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy program_days_own on public.program_days for all to authenticated
  using (exists (select 1 from programs p where p.id = program_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from programs p where p.id = program_id and p.owner_id = auth.uid()));
create policy program_day_exercises_own on public.program_day_exercises for all to authenticated
  using (exists (select 1 from program_days d join programs p on p.id = d.program_id
                 where d.id = day_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from program_days d join programs p on p.id = d.program_id
                      where d.id = day_id and p.owner_id = auth.uid()));

-- Séances : lecture selon can_see_workouts, écriture par le propriétaire.
create policy workouts_read on public.workouts for select to authenticated using (public.can_see_workouts(user_id));
create policy workouts_insert on public.workouts for insert to authenticated with check (user_id = auth.uid());
create policy workouts_update on public.workouts for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy workouts_delete on public.workouts for delete to authenticated using (user_id = auth.uid());

create policy workout_sets_read on public.workout_sets for select to authenticated
  using (exists (select 1 from workouts w where w.id = workout_id and public.can_see_workouts(w.user_id)));
create policy workout_sets_write on public.workout_sets for all to authenticated
  using (exists (select 1 from workouts w where w.id = workout_id and w.user_id = auth.uid()))
  with check (exists (select 1 from workouts w where w.id = workout_id and w.user_id = auth.uid()));

-- Amitiés : visibles par les deux, créées par le demandeur, acceptées par le destinataire.
create policy friendships_read on public.friendships for select to authenticated
  using (auth.uid() in (requester_id, addressee_id));
create policy friendships_insert on public.friendships for insert to authenticated
  with check (requester_id = auth.uid() and status = 'pending');
create policy friendships_accept on public.friendships for update to authenticated
  using (addressee_id = auth.uid()) with check (status = 'accepted');
create policy friendships_delete on public.friendships for delete to authenticated
  using (auth.uid() in (requester_id, addressee_id));
-- Seul le statut peut être modifié (empêche de réécrire requester_id).
revoke update on public.friendships from authenticated;
grant update (status) on public.friendships to authenticated;

-- Réactions : sur une séance qu'on peut lire.
create policy reactions_read on public.reactions for select to authenticated
  using (exists (select 1 from workouts w where w.id = workout_id and public.can_see_workouts(w.user_id)));
create policy reactions_insert on public.reactions for insert to authenticated
  with check (user_id = auth.uid()
              and exists (select 1 from workouts w where w.id = workout_id and public.can_see_workouts(w.user_id)));
create policy reactions_delete on public.reactions for delete to authenticated using (user_id = auth.uid());

-- is_friend n'est utilisé que depuis can_see_workouts (qui s'exécute en tant que propriétaire) :
-- l'appeler directement permettrait de reconstituer le graphe d'amitiés de tout le monde.
revoke execute on function public.is_friend(uuid, uuid) from public, anon, authenticated;
-- can_see_workouts est évaluée par les règles RLS au nom de l'utilisateur connecté.
revoke execute on function public.can_see_workouts(uuid) from public, anon;
grant execute on function public.can_see_workouts(uuid) to authenticated;

-- 003 — Fonctions appelées par l'app et vue du fil d'amis

-- Génère (une seule fois) le code de partage d'un programme qu'on possède.
-- Sur Supabase, pgcrypto (gen_random_bytes) est installé dans le schéma « extensions ».
create function public.share_program(program_id uuid) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  code text;
begin
  select share_code into code from programs where id = program_id and owner_id = auth.uid();
  if not found then raise exception 'Programme introuvable'; end if;
  if code is not null then return code; end if;
  loop
    code := upper(substr(translate(encode(gen_random_bytes(9), 'base64'), '+/=0O1IL', ''), 1, 8));
    exit when length(code) = 8 and not exists (select 1 from programs where share_code = code);
  end loop;
  update programs set share_code = code, updated_at = now() where id = program_id;
  return code;
end $$;

-- Copie un programme partagé chez l'appelant et crée les fiches manquantes.
-- Les exercices perso de l'auteur sont copiés chez l'appelant : la copie reste
-- indépendante, même si l'auteur supprime ses exercices ou son compte.
create function public.import_program(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  src programs;
  new_program uuid := gen_random_uuid();
  d record;
  ex record;
  new_day uuid;
  new_ex uuid;
  ex_map jsonb := '{}';
begin
  if auth.uid() is null then raise exception 'Non connecté'; end if;
  select * into src from programs where share_code = upper(trim(code));
  if not found then raise exception 'Code introuvable'; end if;

  for ex in
    select distinct e.id, e.name, e.muscle_group
    from exercises e
    join program_day_exercises pde on pde.exercise_id = e.id
    join program_days pd on pd.id = pde.day_id
    where pd.program_id = src.id and e.owner_id is not null and e.owner_id <> auth.uid()
  loop
    select id into new_ex from exercises where owner_id = auth.uid() and lower(name) = lower(ex.name) limit 1;
    if new_ex is null then
      new_ex := gen_random_uuid();
      insert into exercises (id, owner_id, name, muscle_group) values (new_ex, auth.uid(), ex.name, ex.muscle_group);
    end if;
    ex_map := ex_map || jsonb_build_object(ex.id::text, new_ex::text);
  end loop;

  insert into programs (id, owner_id, name, is_active) values (new_program, auth.uid(), src.name, false);
  for d in select * from program_days where program_id = src.id order by position loop
    new_day := gen_random_uuid();
    insert into program_days (id, program_id, position, name) values (new_day, new_program, d.position, d.name);
    insert into program_day_exercises (id, day_id, exercise_id, position)
      select gen_random_uuid(), new_day, coalesce((ex_map ->> exercise_id::text)::uuid, exercise_id), position
      from program_day_exercises where day_id = d.id;
  end loop;

  insert into user_exercises (id, user_id, exercise_id)
    select gen_random_uuid(), auth.uid(), x.exercise_id
    from (select distinct e.exercise_id from program_day_exercises e
          join program_days pd on pd.id = e.day_id where pd.program_id = new_program) x
  on conflict (user_id, exercise_id) do nothing;

  return new_program;
end $$;

-- Suppression définitive du compte de l'appelant (cascade sur toutes ses données).
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Non connecté'; end if;
  delete from auth.users where id = auth.uid();
end $$;

-- Recherche par début de pseudo, insensible à la casse, sans soi-même.
create function public.search_profiles(q text) returns setof public.profiles
language sql stable set search_path = public as $$
  select * from profiles
  where lower(username) like replace(replace(replace(lower(trim(q)), '\', '\\'), '%', '\%'), '_', '\_') || '%'
    and user_id <> auth.uid()
  order by username
  limit 20
$$;

-- Fil d'amis : la RLS de workouts ne laisse passer que les amis qui partagent.
create view public.friend_feed with (security_invoker = true) as
select
  w.id,
  w.user_id,
  p.username,
  p.display_name,
  w.name as day_name,
  w.started_at,
  w.finished_at,
  (select count(distinct s.exercise_id) from workout_sets s where s.workout_id = w.id)::int as exercise_count,
  round(extract(epoch from (w.finished_at - w.started_at)) / 60)::int as duration_min,
  (select count(*) from reactions r where r.workout_id = w.id)::int as reaction_count,
  exists (select 1 from reactions r where r.workout_id = w.id and r.user_id = auth.uid()) as reacted_by_me
from workouts w
join profiles p on p.user_id = w.user_id
where w.status = 'done' and w.user_id <> auth.uid();

grant select on public.friend_feed to authenticated;

-- Droits d'exécution : jamais pour les visiteurs non connectés.
revoke execute on function public.share_program(uuid) from public, anon;
revoke execute on function public.import_program(text) from public, anon;
revoke execute on function public.delete_my_account() from public, anon;
revoke execute on function public.search_profiles(text) from public, anon;
grant execute on function public.share_program(uuid) to authenticated;
grant execute on function public.import_program(text) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
grant execute on function public.search_profiles(text) to authenticated;

-- Catalogue global d'exercices
insert into public.exercises (owner_id, name, muscle_group) values
  (null, 'Squat', 'Jambes'),
  (null, 'Front squat', 'Jambes'),
  (null, 'Presse à cuisses', 'Jambes'),
  (null, 'Fentes', 'Jambes'),
  (null, 'Leg extension', 'Jambes'),
  (null, 'Leg curl', 'Jambes'),
  (null, 'Soulevé de terre', 'Dos'),
  (null, 'Soulevé de terre roumain', 'Ischios'),
  (null, 'Hip thrust', 'Fessiers'),
  (null, 'Mollets debout', 'Mollets'),
  (null, 'Développé couché', 'Pectoraux'),
  (null, 'Développé incliné haltères', 'Pectoraux'),
  (null, 'Dips', 'Pectoraux'),
  (null, 'Écarté poulie', 'Pectoraux'),
  (null, 'Pompes', 'Pectoraux'),
  (null, 'Tractions', 'Dos'),
  (null, 'Tirage vertical', 'Dos'),
  (null, 'Rowing barre', 'Dos'),
  (null, 'Rowing haltère', 'Dos'),
  (null, 'Tirage horizontal', 'Dos'),
  (null, 'Développé militaire', 'Épaules'),
  (null, 'Développé haltères assis', 'Épaules'),
  (null, 'Élévations latérales', 'Épaules'),
  (null, 'Face pull', 'Épaules'),
  (null, 'Curl barre', 'Biceps'),
  (null, 'Curl haltères', 'Biceps'),
  (null, 'Curl marteau', 'Biceps'),
  (null, 'Extension triceps poulie', 'Triceps'),
  (null, 'Barre au front', 'Triceps'),
  (null, 'Gainage', 'Abdos'),
  (null, 'Relevés de jambes', 'Abdos'),
  (null, 'Crunch poulie', 'Abdos')
on conflict do nothing;

-- 004 — Catalogue commun : tout exercice créé est visible par tous et classé par partie du corps.

-- 1. Reclassement des exercices existants dans les 12 parties du corps.
update public.exercises set muscle_group = case
  when muscle_group = 'Jambes' then 'Quadriceps'
  when muscle_group in ('Pectoraux', 'Dos', 'Épaules', 'Biceps', 'Triceps', 'Avant-bras',
                        'Abdos', 'Quadriceps', 'Ischios', 'Fessiers', 'Mollets', 'Cardio / Autre') then muscle_group
  else 'Cardio / Autre'
end;

alter table public.exercises alter column muscle_group set not null;
alter table public.exercises add constraint exercises_muscle_group_check check (muscle_group in (
  'Pectoraux', 'Dos', 'Épaules', 'Biceps', 'Triceps', 'Avant-bras',
  'Abdos', 'Quadriceps', 'Ischios', 'Fessiers', 'Mollets', 'Cardio / Autre'));

-- 2. Un exercice survit à la suppression du compte de son créateur
--    (sinon tous ceux qui l'utilisent perdraient leur historique).
do $$
declare fk text;
begin
  select conname into fk from pg_constraint
  where conrelid = 'public.exercises'::regclass and contype = 'f'
    and conkey = array[(select attnum from pg_attribute where attrelid = 'public.exercises'::regclass and attname = 'owner_id')];
  if fk is not null then execute format('alter table public.exercises drop constraint %I', fk); end if;
end $$;
alter table public.exercises add constraint exercises_owner_id_fkey
  foreign key (owner_id) references auth.users(id) on delete set null;

-- 3. Lecture par tous (inchangée) ; création par soi ; plus aucune modification ni suppression
--    depuis l'app (un exercice est partagé par tout le monde).
drop policy if exists exercises_write on public.exercises;
create policy exercises_insert on public.exercises for insert to authenticated
  with check (owner_id = auth.uid());

-- 4. Import de programme : les exercices sont publics, plus besoin de les copier.
create or replace function public.import_program(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  src programs;
  new_program uuid := gen_random_uuid();
  d record;
  new_day uuid;
begin
  if auth.uid() is null then raise exception 'Non connecté'; end if;
  select * into src from programs where share_code = upper(trim(code));
  if not found then raise exception 'Code introuvable'; end if;

  insert into programs (id, owner_id, name, is_active) values (new_program, auth.uid(), src.name, false);
  for d in select * from program_days where program_id = src.id order by position loop
    new_day := gen_random_uuid();
    insert into program_days (id, program_id, position, name) values (new_day, new_program, d.position, d.name);
    insert into program_day_exercises (id, day_id, exercise_id, position)
      select gen_random_uuid(), new_day, exercise_id, position from program_day_exercises where day_id = d.id;
  end loop;

  insert into user_exercises (id, user_id, exercise_id)
    select gen_random_uuid(), auth.uid(), x.exercise_id
    from (select distinct e.exercise_id from program_day_exercises e
          join program_days pd on pd.id = e.day_id where pd.program_id = new_program) x
  on conflict (user_id, exercise_id) do nothing;

  return new_program;
end $$;

-- 005 — Méthodes d'entraînement : modèle de séries par fiche (et par exercice d'un jour),
-- type de chaque série réalisée.

alter table public.user_exercises
  add column if not exists template jsonb,
  add column if not exists auto_progression boolean not null default true,
  add column if not exists rounding numeric(5,2) not null default 2.5 check (rounding > 0);

alter table public.program_day_exercises
  add column if not exists template jsonb;

alter table public.workout_sets
  add column if not exists kind text not null default 'work'
    check (kind in ('warmup', 'work', 'top', 'backoff', 'drop', 'restpause', 'cluster', 'amrap')),
  add column if not exists target_reps_max int check (target_reps_max between 1 and 100);

-- Série « jusqu'à l'échec » : pas de répétitions visées.
alter table public.workout_sets alter column target_reps drop not null;

-- Import d'un programme partagé : la méthode propre à chaque exercice d'un jour est copiée aussi.
create or replace function public.import_program(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  src programs;
  new_program uuid := gen_random_uuid();
  d record;
  new_day uuid;
begin
  if auth.uid() is null then raise exception 'Non connecté'; end if;
  select * into src from programs where share_code = upper(trim(code));
  if not found then raise exception 'Code introuvable'; end if;

  insert into programs (id, owner_id, name, is_active) values (new_program, auth.uid(), src.name, false);
  for d in select * from program_days where program_id = src.id order by position loop
    new_day := gen_random_uuid();
    insert into program_days (id, program_id, position, name) values (new_day, new_program, d.position, d.name);
    insert into program_day_exercises (id, day_id, exercise_id, position, template)
      select gen_random_uuid(), new_day, exercise_id, position, template from program_day_exercises where day_id = d.id;
  end loop;

  insert into user_exercises (id, user_id, exercise_id)
    select gen_random_uuid(), auth.uid(), x.exercise_id
    from (select distinct e.exercise_id from program_day_exercises e
          join program_days pd on pd.id = e.day_id where pd.program_id = new_program) x
  on conflict (user_id, exercise_id) do nothing;

  return new_program;
end $$;

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

-- 008 — Repos : repos de base par fiche d'exercice.

alter table public.user_exercises
  add column if not exists rest_seconds int check (rest_seconds between 10 and 600);

-- Notifications de fin de repos : abonnements Web Push et alarme en attente (une par utilisateur).

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.rest_alarms (
  user_id uuid primary key references auth.users(id) on delete cascade,
  fire_at timestamptz not null,
  title text not null check (length(title) <= 80),
  body text not null default '' check (length(body) <= 200),
  updated_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;
alter table public.rest_alarms enable row level security;

drop policy if exists push_subscriptions_own on public.push_subscriptions;
create policy push_subscriptions_own on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists rest_alarms_own on public.rest_alarms;
create policy rest_alarms_own on public.rest_alarms for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Retire et renvoie les alarmes arrivées à échéance, en une seule opération :
-- deux appels simultanés ne peuvent pas envoyer la même notification.
create or replace function public.take_due_rest_alarms()
returns setof public.rest_alarms
language sql security definer set search_path = public as $$
  delete from rest_alarms where fire_at <= now() returning *;
$$;
revoke all on function public.take_due_rest_alarms() from public, anon, authenticated;
grant execute on function public.take_due_rest_alarms() to service_role;
