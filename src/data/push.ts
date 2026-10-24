import { authStorage } from './authStorage'
import { supabase, supabaseKey, supabaseUrl } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined
/** Alertes activées sur cet appareil (lecture synchrone : utile au moment où la page passe en arrière-plan). */
const FLAG = 'vytrano.push'

export type PushSupport = 'ok' | 'ios-home-screen' | 'unsupported'

const isIos = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)

/** Sur iPhone, le push web n'existe que dans l'app ajoutée à l'écran d'accueil. */
export function pushSupport(): PushSupport {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && VAPID_PUBLIC_KEY) return 'ok'
  return isIos() ? 'ios-home-screen' : 'unsupported'
}

export function pushEnabledFlag(): boolean {
  try { return localStorage.getItem(FLAG) === '1' } catch { return false }
}

function setFlag(on: boolean) {
  try { if (on) localStorage.setItem(FLAG, '1'); else localStorage.removeItem(FLAG) } catch { /* sans effet */ }
}

function base64ToBytes(b64: string): Uint8Array {
  const raw = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

/** Demande la permission, s'abonne et enregistre l'abonnement côté serveur. */
export async function enablePush(userId: string): Promise<'enabled' | 'denied' | 'error'> {
  try {
    if (pushSupport() !== 'ok') return 'error'
    if ((await Notification.requestPermission()) !== 'granted') return 'denied'
    const reg = await navigator.serviceWorker.ready
    const sub = (await reg.pushManager.getSubscription())
      ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(VAPID_PUBLIC_KEY!) })
    const json = sub.toJSON()
    const { error } = await supabase.from('push_subscriptions').upsert(
      { user_id: userId, endpoint: sub.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth },
      { onConflict: 'endpoint' },
    )
    if (error) return 'error'
    setFlag(true)
    return 'enabled'
  } catch {
    return 'error'
  }
}

export async function disablePush(): Promise<void> {
  setFlag(false)
  try {
    const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription()
    if (!sub) return
    await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
    await sub.unsubscribe()
  } catch { /* déjà désabonné ou hors ligne */ }
}

/** Jeton de la session, lu directement : la page passe en arrière-plan, pas le temps d'attendre. */
function accessToken(): string | null {
  try {
    const ref = new URL(supabaseUrl).hostname.split('.')[0]
    return JSON.parse(authStorage.getItem(`sb-${ref}-auth-token`) ?? 'null')?.access_token ?? null
  } catch {
    return null
  }
}

/** File des requêtes : une annulation part après la programmation qui la précède, jamais avant. */
let queue: Promise<unknown> = Promise.resolve()

/** `background` : la page passe en arrière-plan, la requête doit lui survivre (keepalive). */
function send(path: string, method: 'POST' | 'DELETE', body?: unknown, background = false) {
  const token = accessToken()
  if (!token) return
  queue = queue.then(() => fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method, keepalive: background,
    headers: {
      apikey: supabaseKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })).catch(() => { /* hors ligne : l'alerte dans l'app suffira */ })
}

/** Programme la notification de fin de repos (une seule par utilisateur, remplacée). */
export function scheduleRestAlarm(userId: string, fireAt: number, body: string, background = false) {
  send('rest_alarms', 'POST', { user_id: userId, fire_at: new Date(fireAt).toISOString(), title: 'Repos terminé', body: body.slice(0, 200) }, background)
}

export function cancelRestAlarm(userId: string, background = false) {
  send(`rest_alarms?user_id=eq.${encodeURIComponent(userId)}`, 'DELETE', undefined, background)
}
