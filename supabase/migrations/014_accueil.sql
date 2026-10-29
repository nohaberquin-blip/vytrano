-- 014 — Accueil : disposition personnalisée (ordre, couleurs, éléments masqués).
-- Rien de sensible : les profils restent lisibles par les connectés comme avant ; taille bornée.

alter table public.profiles add column if not exists home jsonb;
alter table public.profiles drop constraint if exists profiles_home_size;
alter table public.profiles add constraint profiles_home_size
  check (home is null or (jsonb_typeof(home) = 'object' and octet_length(home::text) <= 4096));
