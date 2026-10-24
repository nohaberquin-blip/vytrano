-- 008 — Repos : repos de base par fiche d'exercice.

alter table public.user_exercises
  add column if not exists rest_seconds int check (rest_seconds between 10 and 600);
