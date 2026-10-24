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
