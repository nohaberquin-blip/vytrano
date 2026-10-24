-- 003 — Fonctions appelées par l'app et vue du fil d'amis

-- Génère (une seule fois) le code de partage d'un programme qu'on possède.
create function public.share_program(program_id uuid) returns text
language plpgsql security definer set search_path = public as $$
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
create function public.import_program(code text) returns uuid
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
