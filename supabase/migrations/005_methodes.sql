-- 005 — Méthodes d'entraînement : modèle de séries par fiche (et par exercice d'un jour),
-- type de chaque série réalisée.

alter table public.user_exercises
  add column if not exists template jsonb,
  add column if not exists auto_progression boolean not null default true,
  add column if not exists rounding numeric(5,2) not null default 2.5 check (rounding > 0);

alter table public.program_day_exercises
  add column if not exists template jsonb;

alter table public.workout_sets
  add column if not exists kind text not null default 'work'
    check (kind in ('warmup', 'work', 'top', 'backoff', 'drop', 'restpause', 'cluster', 'amrap')),
  add column if not exists target_reps_max int check (target_reps_max between 1 and 100);

-- Série « jusqu'à l'échec » : pas de répétitions visées.
alter table public.workout_sets alter column target_reps drop not null;
