-- Vérification des règles d'accès. À coller dans l'éditeur SQL Supabase APRÈS 001 → 003.
-- Crée 3 utilisateurs de test (A, B, C), vérifie les règles, puis les supprime.
-- Succès : le résultat final affiche « RLS OK ». Échec : une erreur « ÉCHEC : … ».
begin;

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'rls-a@test.local', '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'rls-b@test.local', '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'cccccccc-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'rls-c@test.local', '', now(), now());

update public.profiles set username = 'rls_lea' where user_id = 'bbbbbbbb-0000-0000-0000-000000000002';
insert into public.friendships (requester_id, addressee_id, status)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'accepted');
insert into public.workouts (id, user_id, name, started_at, finished_at, status)
  values ('dddddddd-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'Jour 1', now() - interval '1 hour', now(), 'done');

-- B, ami de A
select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true);
do $$ begin
  if not exists (select 1 from workouts where id = 'dddddddd-0000-0000-0000-000000000004') then
    raise exception 'ÉCHEC : B (ami) devrait voir la séance de A'; end if;
  if not exists (select 1 from friend_feed where id = 'dddddddd-0000-0000-0000-000000000004') then
    raise exception 'ÉCHEC : la séance de A devrait être dans le fil de B'; end if;
  update workouts set name = 'piraté' where id = 'dddddddd-0000-0000-0000-000000000004';
  if exists (select 1 from workouts where name = 'piraté') then
    raise exception 'ÉCHEC : B ne doit pas modifier la séance de A'; end if;
  begin
    insert into friendships (requester_id, addressee_id) values ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001');
    raise exception 'ÉCHEC : demande inversée en double acceptée';
  exception when unique_violation then null; end;
end $$;

-- C, non ami
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true);
do $$ begin
  if exists (select 1 from workouts where id = 'dddddddd-0000-0000-0000-000000000004') then
    raise exception 'ÉCHEC : C (non ami) ne doit pas voir la séance de A'; end if;
  begin
    insert into friendships (requester_id, addressee_id) values ('cccccccc-0000-0000-0000-000000000003', 'cccccccc-0000-0000-0000-000000000003');
    raise exception 'ÉCHEC : demande d''ami à soi-même acceptée';
  exception when check_violation then null; end;
  insert into friendships (requester_id, addressee_id) values ('cccccccc-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001');
  update friendships set status = 'accepted' where requester_id = 'cccccccc-0000-0000-0000-000000000003';
  if exists (select 1 from friendships where requester_id = 'cccccccc-0000-0000-0000-000000000003' and status = 'accepted') then
    raise exception 'ÉCHEC : C ne doit pas accepter sa propre demande'; end if;
end $$;

-- A
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
do $$ begin
  begin
    update profiles set username = 'RLS_LEA' where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
    raise exception 'ÉCHEC : pseudo en double (casse différente) accepté';
  exception when unique_violation then null; end;
  if not exists (select 1 from search_profiles('rls_l')) then
    raise exception 'ÉCHEC : la recherche devrait trouver rls_lea'; end if;
  update profiles set share_workouts = false where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
end $$;

-- B après que A a coupé le partage
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true);
do $$ begin
  if exists (select 1 from workouts where id = 'dddddddd-0000-0000-0000-000000000004') then
    raise exception 'ÉCHEC : B ne doit plus voir la séance de A quand le partage est coupé'; end if;
end $$;

-- Nettoyage
select set_config('role', 'postgres', true);
delete from auth.users where email like 'rls-%@test.local';
commit;

select 'RLS OK' as resultat;
