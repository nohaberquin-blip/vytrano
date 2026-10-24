-- 009 — Envoi des notifications de fin de repos : toutes les 5 secondes, s'il y a une alarme due,
-- appel de la fonction « rest-alarms » (qui envoie les notifications Web Push).
-- Prérequis : Database → Extensions → activer « pg_cron » et « pg_net », et la fonction déployée.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.unschedule(jobid) from cron.job where jobname = 'rest-alarms';

select cron.schedule('rest-alarms', '5 seconds', $$
  select net.http_post(
    url := 'https://kkusotincuwjjokyyfjl.supabase.co/functions/v1/rest-alarms',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  )
  where exists (select 1 from public.rest_alarms where fire_at <= now());
$$);
