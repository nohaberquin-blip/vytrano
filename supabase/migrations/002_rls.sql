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
