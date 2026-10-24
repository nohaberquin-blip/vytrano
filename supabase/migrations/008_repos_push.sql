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
