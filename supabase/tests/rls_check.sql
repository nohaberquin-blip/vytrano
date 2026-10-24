-- Vérification des règles d'accès. À coller dans l'éditeur SQL Supabase APRÈS setup_all.sql (001 → 008, 010 → 012 et le seed).
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
insert into public.program_day_exercises (id, day_id, exercise_id, position, template, priority) values ('ffffffff-0000-0000-0000-000000000008', 'ffffffff-0000-0000-0000-000000000007', 'eeeeeeee-0000-0000-0000-000000000005', 0, '{"method":"top_backoff","sets":[{"kind":"top","reps":5,"pct":100}]}', true);
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
  if not exists (select 1 from program_day_exercises pde join program_days pd on pd.id = pde.day_id
                 where pd.program_id = new_program and pde.template ->> 'method' = 'top_backoff' and pde.priority) then
    raise exception 'ÉCHEC : l''import doit copier la méthode et l''étoile de chaque exercice du jour'; end if;
  if ex_owner is distinct from 'aaaaaaaa-0000-0000-0000-000000000001'::uuid then
    raise exception 'ÉCHEC : l''import doit réutiliser l''exercice public de A'; end if;
  if (select count(*) from user_exercises where user_id = 'cccccccc-0000-0000-0000-000000000003') <> 1 then
    raise exception 'ÉCHEC : l''import doit créer la fiche de C'; end if;
end $$;

-- ─── Calendrier : privé (B, ami de A, ne voit ni n'écrit rien) ───
select set_config('role', 'postgres', true);
insert into public.training_schedules (id, user_id, weekdays, since)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '{1,3,5}', current_date);
insert into public.schedule_overrides (user_id, date, kind, moved_to)
  values ('aaaaaaaa-0000-0000-0000-000000000001', '2026-10-23', 'rest', '2026-10-24');
insert into public.weekly_goals (user_id, week_start, sessions)
  values ('aaaaaaaa-0000-0000-0000-000000000001', '2026-10-19', 4);
do $$ begin
  begin
    insert into public.training_schedules (id, user_id, weekdays) values ('bbbbbbbb-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', '{8}');
    raise exception 'ÉCHEC : un jour 8 doit être refusé';
  exception when check_violation then null; end;
  begin
    insert into public.weekly_goals (user_id, week_start, sessions) values ('bbbbbbbb-0000-0000-0000-000000000002', '2026-10-20', 3);
    raise exception 'ÉCHEC : un objectif doit commencer un lundi';
  exception when check_violation then null; end;
end $$;
select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true);
do $$ begin
  if exists (select 1 from training_schedules where user_id = 'aaaaaaaa-0000-0000-0000-000000000001')
     or exists (select 1 from schedule_overrides where user_id = 'aaaaaaaa-0000-0000-0000-000000000001')
     or exists (select 1 from weekly_goals where user_id = 'aaaaaaaa-0000-0000-0000-000000000001') then
    raise exception 'ÉCHEC : B ne doit pas voir le calendrier de A'; end if;
  begin
    insert into schedule_overrides (user_id, date, kind) values ('aaaaaaaa-0000-0000-0000-000000000001', '2026-10-25', 'train');
    raise exception 'ÉCHEC : B ne doit pas écrire dans le calendrier de A';
  exception when insufficient_privilege then null; end;
  insert into schedule_overrides (user_id, date, kind) values ('bbbbbbbb-0000-0000-0000-000000000002', '2026-10-25', 'train');
end $$;
select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
do $$ begin
  if not exists (select 1 from schedule_overrides where moved_to = '2026-10-24') then
    raise exception 'ÉCHEC : A doit voir ses exceptions'; end if;
  if exists (select 1 from schedule_overrides where user_id <> 'aaaaaaaa-0000-0000-0000-000000000001') then
    raise exception 'ÉCHEC : A ne doit pas voir le calendrier de B'; end if;
end $$;

-- ─── Fiche et pesées : privées ───
select set_config('role', 'postgres', true);
insert into public.body_profiles (id, user_id, sex, height_cm, goal)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'male', 180, 'cut');
insert into public.weight_entries (id, user_id, date, weight_kg)
  values ('abababab-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '2026-10-25', 75.4);
do $$ begin
  begin
    insert into public.body_profiles (id, user_id, height_cm) values ('bbbbbbbb-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 300);
    raise exception 'ÉCHEC : une taille de 300 cm doit être refusée';
  exception when check_violation then null; end;
  begin
    insert into public.body_profiles (id, user_id, fat_pct) values ('bbbbbbbb-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 50);
    raise exception 'ÉCHEC : 50 pour cent de lipides doit être refusé';
  exception when check_violation then null; end;
  begin
    insert into public.weight_entries (id, user_id, date, weight_kg) values (gen_random_uuid(), 'bbbbbbbb-0000-0000-0000-000000000002', '2026-10-25', 20);
    raise exception 'ÉCHEC : un poids de 20 kg doit être refusé';
  exception when check_violation then null; end;
end $$;
select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true);
do $$ begin
  if exists (select 1 from body_profiles where user_id = 'aaaaaaaa-0000-0000-0000-000000000001')
     or exists (select 1 from weight_entries where user_id = 'aaaaaaaa-0000-0000-0000-000000000001') then
    raise exception 'ÉCHEC : B ne doit pas voir la fiche ni les pesées de A'; end if;
  begin
    insert into weight_entries (id, user_id, date, weight_kg) values (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', '2026-10-24', 80);
    raise exception 'ÉCHEC : B ne doit pas écrire les pesées de A';
  exception when insufficient_privilege then null; end;
end $$;

-- ─── Repos de base : bornes ───
select set_config('role', 'postgres', true);
do $$ begin
  begin
    insert into public.user_exercises (id, user_id, exercise_id, rest_seconds)
      values (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000005', 5);
    raise exception 'ÉCHEC : un repos de 5 s doit être refusé';
  exception when check_violation then null; end;
end $$;

-- ─── Alertes de repos : privées ; envoi réservé au serveur ───
select set_config('role', 'postgres', true);
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'https://push.test/rls-a', 'k', 'a');
insert into public.rest_alarms (user_id, fire_at, title, body)
  values ('aaaaaaaa-0000-0000-0000-000000000001', now() + interval '1 hour', 'Repos terminé', 'RLS');
select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true);
do $$ begin
  if exists (select 1 from push_subscriptions where user_id = 'aaaaaaaa-0000-0000-0000-000000000001')
     or exists (select 1 from rest_alarms where user_id = 'aaaaaaaa-0000-0000-0000-000000000001') then
    raise exception 'ÉCHEC : B ne doit pas voir les alertes de A'; end if;
  begin
    perform public.take_due_rest_alarms();
    raise exception 'ÉCHEC : un utilisateur ne doit pas pouvoir vider les alarmes';
  exception when insufficient_privilege then null; end;
  insert into rest_alarms (user_id, fire_at, title) values ('bbbbbbbb-0000-0000-0000-000000000002', now(), 'Repos terminé');
end $$;

-- ─── Temps disponible : entre 10 et 180 min ───
select set_config('role', 'postgres', true);
do $$ begin
  begin
    insert into public.workouts (id, user_id, name, started_at, status, time_limit)
      values (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', 'RLS', now(), 'in_progress', 5);
    raise exception 'ÉCHEC : un temps de 5 min doit être refusé';
  exception when check_violation then null; end;
end $$;

-- ─── Mon cycle : règles et allègements privés, durée 2 à 10 jours, allègement connu ───
select set_config('role', 'postgres', true);
insert into public.periods (id, user_id, start, days)
  values ('acacacac-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '2026-10-01', 5);
insert into public.workouts (id, user_id, name, started_at, finished_at, status)
  values ('adadadad-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'RLS allégée', now(), now(), 'done');
insert into public.workout_lightenings (id, user_id, mode)
  values ('adadadad-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'minus10');
-- Partage réactivé : on vérifie le cas d'un ami qui voit les séances.
update public.profiles set share_workouts = true where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
do $$ begin
  begin
    insert into public.periods (id, user_id, start, days) values (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', '2026-11-01', 1);
    raise exception 'ÉCHEC : des règles d''un jour doivent être refusées';
  exception when check_violation then null; end;
  begin
    update public.workout_lightenings set mode = 'x' where id = 'adadadad-0000-0000-0000-000000000001';
    raise exception 'ÉCHEC : un allègement inconnu doit être refusé';
  exception when check_violation then null; end;
end $$;
select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
do $$ begin
  if not exists (select 1 from periods where user_id = 'aaaaaaaa-0000-0000-0000-000000000001')
     or not exists (select 1 from workout_lightenings where user_id = 'aaaaaaaa-0000-0000-0000-000000000001') then
    raise exception 'ÉCHEC : A doit voir ses règles et ses allègements'; end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true);
do $$ begin
  -- B, ami de A, voit la séance (partage activé) mais rien qui trahisse les règles.
  if not exists (select 1 from workouts where id = 'adadadad-0000-0000-0000-000000000001') then
    raise exception 'ÉCHEC : B (ami) doit voir la séance de A'; end if;
  if exists (select 1 from periods where user_id = 'aaaaaaaa-0000-0000-0000-000000000001')
     or exists (select 1 from workout_lightenings where user_id = 'aaaaaaaa-0000-0000-0000-000000000001') then
    raise exception 'ÉCHEC : B ne doit voir ni les règles ni les allègements de A'; end if;
  begin
    insert into periods (id, user_id, start, days) values (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', '2026-12-01', 5);
    raise exception 'ÉCHEC : B ne doit pas écrire les règles de A';
  exception when insufficient_privilege then null; end;
end $$;

-- ─── Régularité : carte visible par les amis seulement, écrite par soi seulement ───
select set_config('role', 'postgres', true);
do $$ begin
  if (select share_progress from public.profiles where user_id = 'aaaaaaaa-0000-0000-0000-000000000001') then
    raise exception 'ÉCHEC : le partage de la progression doit être désactivé par défaut'; end if;
end $$;
insert into public.progress_cards (user_id, level, title, streak, badges)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 4, 'Débutant', 6, '{sessions-1,sessions-10}');
select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true);
do $$ begin
  if not exists (select 1 from progress_cards where user_id = 'aaaaaaaa-0000-0000-0000-000000000001') then
    raise exception 'ÉCHEC : B (ami) doit voir la carte de A'; end if;
  update progress_cards set level = 99 where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  if (select level from progress_cards where user_id = 'aaaaaaaa-0000-0000-0000-000000000001') <> 4 then
    raise exception 'ÉCHEC : B ne doit pas modifier la carte de A'; end if;
  begin
    insert into progress_cards (user_id, level, title, streak) values ('cccccccc-0000-0000-0000-000000000003', 1, 'Débutant', 0);
    raise exception 'ÉCHEC : B ne doit pas écrire la carte de C';
  exception when insufficient_privilege then null; end;
  begin
    perform public.is_friend('aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000003');
    raise exception 'ÉCHEC : is_friend ne doit pas être appelable';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true);
do $$ begin
  if exists (select 1 from progress_cards where user_id = 'aaaaaaaa-0000-0000-0000-000000000001') then
    raise exception 'ÉCHEC : C (pas ami) ne doit pas voir la carte de A'; end if;
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
