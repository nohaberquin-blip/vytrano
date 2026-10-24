-- Vérification des règles d'accès. À coller dans l'éditeur SQL Supabase APRÈS 001 → 003 et le seed.
-- Crée 3 utilisateurs de test (A, B, C), vérifie les règles, puis les supprime.
-- Succès : le résultat final affiche « RLS OK ». Échec : une erreur « ÉCHEC : … »
-- (toute la transaction est alors annulée, rien ne reste en base).
--   A et B sont amis ; C n'est ami avec personne.
begin;

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'rls-a@test.local', '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'rls-b@test.local', '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'cccccccc-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'rls-c@test.local', '', now(), now());

update public.profiles set username = 'rls_lea' where user_id = 'bbbbbbbb-0000-0000-0000-000000000002';
insert into public.friendships (requester_id, addressee_id, status)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'accepted');

-- Données de A : un exercice créé par A, un programme d'un jour, une séance terminée avec une série.
insert into public.exercises (id, owner_id, name, muscle_group) values ('eeeeeeee-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000001', 'RLS curl perso', 'Biceps');
insert into public.programs (id, owner_id, name, is_active) values ('ffffffff-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000001', 'RLS prog', true);
insert into public.program_days (id, program_id, position, name) values ('ffffffff-0000-0000-0000-000000000007', 'ffffffff-0000-0000-0000-000000000006', 0, 'Jour 1');
insert into public.program_day_exercises (id, day_id, exercise_id, position) values ('ffffffff-0000-0000-0000-000000000008', 'ffffffff-0000-0000-0000-000000000007', 'eeeeeeee-0000-0000-0000-000000000005', 0);
insert into public.workouts (id, user_id, name, started_at, finished_at, status)
  values ('dddddddd-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'Jour 1', now() - interval '1 hour', now(), 'done');
insert into public.workout_sets (id, workout_id, exercise_id, position, target_reps, reps, weight, done, kind)
  values ('dddddddd-0000-0000-0000-000000000009', 'dddddddd-0000-0000-0000-000000000004', 'eeeeeeee-0000-0000-0000-000000000005', 0, 8, 8, 20, true, 'top');

-- ─── B, ami de A (partage activé) ───
select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true);
do $$ begin
  if not exists (select 1 from workouts where id = 'dddddddd-0000-0000-0000-000000000004') then
    raise exception 'ÉCHEC : B (ami) devrait voir la séance de A'; end if;
  if not exists (select 1 from workout_sets where workout_id = 'dddddddd-0000-0000-0000-000000000004' and kind = 'top') then
    raise exception 'ÉCHEC : B (ami) devrait voir les séries de A et leur type'; end if;
  if not exists (select 1 from friend_feed where id = 'dddddddd-0000-0000-0000-000000000004') then
    raise exception 'ÉCHEC : la séance de A devrait être dans le fil de B'; end if;
  insert into reactions (workout_id, user_id) values ('dddddddd-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000002');
  if exists (select 1 from programs where id = 'ffffffff-0000-0000-0000-000000000006') then
    raise exception 'ÉCHEC : B ne doit pas voir les programmes de A'; end if;
  update workouts set name = 'piraté' where id = 'dddddddd-0000-0000-0000-000000000004';
  if exists (select 1 from workouts where name = 'piraté') then
    raise exception 'ÉCHEC : B ne doit pas modifier la séance de A'; end if;
  begin
    insert into friendships (requester_id, addressee_id) values ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001');
    raise exception 'ÉCHEC : demande inversée en double acceptée';
  exception when unique_violation then null; end;
  begin
    perform is_friend('aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000003');
    raise exception 'ÉCHEC : is_friend ne doit pas être appelable directement';
  exception when insufficient_privilege then null; end;
end $$;

-- ─── C, non ami ───
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true);
do $$ begin
  if not exists (select 1 from exercises where id = 'eeeeeeee-0000-0000-0000-000000000005') then
    raise exception 'ÉCHEC : un exercice créé par A doit être visible par tous'; end if;
  update exercises set name = 'piraté' where id = 'eeeeeeee-0000-0000-0000-000000000005';
  delete from exercises where id = 'eeeeeeee-0000-0000-0000-000000000005';
  if not exists (select 1 from exercises where id = 'eeeeeeee-0000-0000-0000-000000000005' and name = 'RLS curl perso') then
    raise exception 'ÉCHEC : un exercice ne doit être ni renommé ni supprimé depuis l''app'; end if;
  begin
    insert into exercises (owner_id, name, muscle_group) values ('cccccccc-0000-0000-0000-000000000003', 'RLS sans partie', 'Jambes');
    raise exception 'ÉCHEC : une partie du corps hors liste doit être refusée';
  exception when check_violation then null; end;
  insert into exercises (owner_id, name, muscle_group) values ('cccccccc-0000-0000-0000-000000000003', 'RLS mollets C', 'Mollets');
  if exists (select 1 from workouts where id = 'dddddddd-0000-0000-0000-000000000004') then
    raise exception 'ÉCHEC : C (non ami) ne doit pas voir la séance de A'; end if;
  if exists (select 1 from workout_sets where workout_id = 'dddddddd-0000-0000-0000-000000000004') then
    raise exception 'ÉCHEC : C (non ami) ne doit pas voir les séries de A'; end if;
  if exists (select 1 from reactions where workout_id = 'dddddddd-0000-0000-0000-000000000004') then
    raise exception 'ÉCHEC : C ne doit pas voir les réactions sur la séance de A'; end if;
  begin
    insert into reactions (workout_id, user_id) values ('dddddddd-0000-0000-0000-000000000004', 'cccccccc-0000-0000-0000-000000000003');
    raise exception 'ÉCHEC : C ne doit pas réagir à une séance qu''il ne voit pas';
  exception when insufficient_privilege then null; end;
  begin
    insert into friendships (requester_id, addressee_id) values ('cccccccc-0000-0000-0000-000000000003', 'cccccccc-0000-0000-0000-000000000003');
    raise exception 'ÉCHEC : demande d''ami à soi-même acceptée';
  exception when check_violation then null; end;
  insert into friendships (requester_id, addressee_id) values ('cccccccc-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001');
  update friendships set status = 'accepted' where requester_id = 'cccccccc-0000-0000-0000-000000000003';
  if exists (select 1 from friendships where requester_id = 'cccccccc-0000-0000-0000-000000000003' and status = 'accepted') then
    raise exception 'ÉCHEC : C ne doit pas accepter sa propre demande'; end if;
  delete from friendships where requester_id = 'cccccccc-0000-0000-0000-000000000003';
end $$;

-- ─── A : pseudo, recherche, partage du programme, puis coupe le partage des séances ───
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
do $$ declare code text; code2 text; begin
  insert into workout_sets (id, workout_id, exercise_id, position, target_reps, reps, weight, done, kind)
    values (gen_random_uuid(), 'dddddddd-0000-0000-0000-000000000004', 'eeeeeeee-0000-0000-0000-000000000005', 1, null, 6, 16, true, 'drop');
  begin
    insert into workout_sets (id, workout_id, exercise_id, position, target_reps, reps, weight, done, kind)
      values (gen_random_uuid(), 'dddddddd-0000-0000-0000-000000000004', 'eeeeeeee-0000-0000-0000-000000000005', 2, 8, 8, 20, true, 'nope');
    raise exception 'ÉCHEC : un type de série inconnu doit être refusé';
  exception when check_violation then null; end;
  begin
    update profiles set username = 'RLS_LEA' where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
    raise exception 'ÉCHEC : pseudo en double (casse différente) accepté';
  exception when unique_violation then null; end;
  if not exists (select 1 from search_profiles('rls_l')) then
    raise exception 'ÉCHEC : la recherche devrait trouver rls_lea'; end if;
  code := share_program('ffffffff-0000-0000-0000-000000000006');
  if code is null or length(code) <> 8 then raise exception 'ÉCHEC : code de partage invalide (%)', code; end if;
  code2 := share_program('ffffffff-0000-0000-0000-000000000006');
  if code2 <> code then raise exception 'ÉCHEC : share_program doit renvoyer le même code'; end if;
  perform set_config('rls.code', code, true);
  update profiles set share_workouts = false where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
end $$;

-- ─── B après que A a coupé le partage ───
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true);
do $$ begin
  if exists (select 1 from workouts where id = 'dddddddd-0000-0000-0000-000000000004') then
    raise exception 'ÉCHEC : B ne doit plus voir la séance de A quand le partage est coupé'; end if;
  if exists (select 1 from workout_sets where workout_id = 'dddddddd-0000-0000-0000-000000000004') then
    raise exception 'ÉCHEC : B ne doit plus voir les séries de A quand le partage est coupé'; end if;
  if exists (select 1 from friend_feed where user_id = 'aaaaaaaa-0000-0000-0000-000000000001') then
    raise exception 'ÉCHEC : le fil de B ne doit plus contenir A'; end if;
end $$;

-- ─── C importe le programme de A ───
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true);
do $$ declare new_program uuid; ex_owner uuid; begin
  begin
    perform import_program('ZZZZZZZZ');
    raise exception 'ÉCHEC : un code inconnu devrait être refusé';
  exception when raise_exception then
    if sqlerrm not like '%introuvable%' then raise; end if;
  end;
  new_program := import_program(current_setting('rls.code'));
  if not exists (select 1 from programs where id = new_program and owner_id = 'cccccccc-0000-0000-0000-000000000003' and share_code is null) then
    raise exception 'ÉCHEC : le programme importé doit appartenir à C, sans code'; end if;
  select e.owner_id into ex_owner
  from program_day_exercises pde join program_days pd on pd.id = pde.day_id join exercises e on e.id = pde.exercise_id
  where pd.program_id = new_program;
  if ex_owner is distinct from 'aaaaaaaa-0000-0000-0000-000000000001'::uuid then
    raise exception 'ÉCHEC : l''import doit réutiliser l''exercice public de A'; end if;
  if (select count(*) from user_exercises where user_id = 'cccccccc-0000-0000-0000-000000000003') <> 1 then
    raise exception 'ÉCHEC : l''import doit créer la fiche de C'; end if;
end $$;

-- ─── Suppression du compte de A : son exercice reste, sans propriétaire ───
select set_config('role', 'postgres', true);
delete from auth.users where id = 'aaaaaaaa-0000-0000-0000-000000000001';
do $$ begin
  if not exists (select 1 from public.exercises where id = 'eeeeeeee-0000-0000-0000-000000000005' and owner_id is null) then
    raise exception 'ÉCHEC : l''exercice de A doit survivre à la suppression de son compte'; end if;
end $$;

-- Nettoyage
delete from auth.users where email like 'rls-%@test.local';
delete from public.exercises where name like 'RLS %';
commit;

select 'RLS OK' as resultat;
