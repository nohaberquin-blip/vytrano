-- 010 — Temps disponible : exercice prioritaire dans un jour de programme, temps choisi pour une séance.

alter table public.program_day_exercises
  add column if not exists priority boolean not null default false;

alter table public.workouts
  add column if not exists time_limit smallint check (time_limit between 10 and 180);

-- Import d'un programme partagé : l'étoile « prioritaire » est copiée aussi.
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
    insert into program_day_exercises (id, day_id, exercise_id, position, template, priority)
      select gen_random_uuid(), new_day, exercise_id, position, template, priority from program_day_exercises where day_id = d.id;
  end loop;

  insert into user_exercises (id, user_id, exercise_id)
    select gen_random_uuid(), auth.uid(), x.exercise_id
    from (select distinct e.exercise_id from program_day_exercises e
          join program_days pd on pd.id = e.day_id where pd.program_id = new_program) x
  on conflict (user_id, exercise_id) do nothing;

  return new_program;
end $$;
