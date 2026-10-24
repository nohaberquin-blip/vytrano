// Envoie les notifications de fin de repos arrivées à échéance (appelée toutes les 5 s par pg_cron).
// Déployée sans vérification de JWT : elle ne fait qu'envoyer ce qui est déjà dû.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT')!,
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)
const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

Deno.serve(async () => {
  const { data: alarms, error } = await supabase.rpc('take_due_rest_alarms')
  if (error) return new Response(error.message, { status: 500 })

  let sent = 0
  for (const alarm of alarms ?? []) {
    const { data: subs } = await supabase.from('push_subscriptions').select('*').eq('user_id', alarm.user_id)
    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title: alarm.title, body: alarm.body }),
          { TTL: 120, urgency: 'high' },
        )
        sent++
      } catch (e) {
        // Abonnement expiré ou révoqué : on l'oublie.
        const status = (e as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) await supabase.from('push_subscriptions').delete().eq('id', s.id)
      }
    }
  }
  return Response.json({ alarms: alarms?.length ?? 0, sent })
})
