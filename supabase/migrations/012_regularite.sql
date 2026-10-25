-- 012 — Régularité : résumé (niveau, titre, série, badges) visible par les amis, seulement si on le partage.

alter table public.profiles
  add column if not exists share_progress boolean not null default false;

create table if not exists public.progress_cards (
  user_id uuid primary key references auth.users(id) on delete cascade,
  level smallint not null check (level between 1 and 999),
  title text not null check (length(title) <= 30),
  streak smallint not null check (streak between 0 and 9999),
  badges text[] not null default '{}' check (cardinality(badges) <= 50),
  updated_at timestamptz not null default now()
);

-- Comme can_see_workouts : soi-même, ou un ami accepté si le propriétaire partage (vérifié par le
-- serveur : un appareil resté ouvert avec un réglage périmé ne peut pas rendre la carte visible).
create or replace function public.can_see_progress(owner uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select owner = auth.uid()
    or (public.is_friend(auth.uid(), owner)
        and exists (select 1 from profiles p where p.user_id = owner and p.share_progress))
$$;
revoke execute on function public.can_see_progress(uuid) from public, anon;
grant execute on function public.can_see_progress(uuid) to authenticated;

alter table public.progress_cards enable row level security;
drop policy if exists progress_cards_read on public.progress_cards;
create policy progress_cards_read on public.progress_cards for select to authenticated
  using (public.can_see_progress(user_id));
drop policy if exists progress_cards_write on public.progress_cards;
create policy progress_cards_write on public.progress_cards for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid()
              and exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.share_progress));
