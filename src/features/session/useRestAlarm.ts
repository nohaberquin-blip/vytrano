import { useEffect, useRef } from 'react'
import { cancelRestAlarm, pushEnabledFlag, scheduleRestAlarm } from '../../data/push'
import type { RestState } from './useRestTimer'

/** App au premier plan : l'alarme serveur est retirée peu avant la fin, le bip de l'app prend le relais. */
const FOREGROUND_HANDOFF_MS = 6000
/** App en arrière-plan : inutile de programmer s'il ne reste presque plus rien. */
const MIN_AHEAD_MS = 1000

/**
 * Tient l'alarme serveur (notification de fin de repos) à jour.
 * Elle est programmée dès le début du repos, app ouverte : au verrouillage, l'iPhone met l'app en pause
 * presque aussitôt, une requête envoyée à ce moment-là n'a pas le temps de partir.
 */
export function useRestAlarm(userId: string, rest: RestState | null) {
  const current = useRef(rest)
  current.current = rest
  /** Dernier état envoyé : heure de fin programmée, 'none' (annulée), null (inconnu : premier passage). */
  const sent = useRef<string | null>(null)

  const sync = useRef(() => {})
  sync.current = () => {
    if (!pushEnabledFlag()) return
    const r = current.current
    const hidden = document.visibilityState === 'hidden'
    const left = r ? r.endsAt - Date.now() : 0
    const want = r && left > (hidden ? MIN_AHEAD_MS : FOREGROUND_HANDOFF_MS) ? String(r.endsAt) : 'none'
    if (want === sent.current) return
    sent.current = want
    if (want === 'none') cancelRestAlarm(userId)
    else scheduleRestAlarm(userId, r!.endsAt, r!.next, hidden)
  }

  useEffect(() => {
    const onChange = () => sync.current()
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [])

  const endsAt = rest?.endsAt
  useEffect(() => {
    sync.current()
    if (endsAt === undefined) return
    const t = setTimeout(() => sync.current(), Math.max(0, endsAt - FOREGROUND_HANDOFF_MS - Date.now()) + 50)
    return () => clearTimeout(t)
  }, [endsAt, userId])
}
