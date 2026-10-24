import { useEffect, useRef } from 'react'
import { cancelRestAlarm, pushEnabledFlag, scheduleRestAlarm } from '../../data/push'
import type { RestState } from './useRestTimer'

/** En dessous, inutile de programmer une notification : le temps qu'elle parte, le repos est fini. */
const MIN_AHEAD_MS = 3000

/**
 * Quand l'app passe en arrière-plan pendant un repos, la fin est confiée au serveur (notification) ;
 * au retour, l'alarme est annulée : l'app au premier plan sonne elle-même.
 */
export function useRestAlarm(userId: string, rest: RestState | null) {
  const current = useRef(rest)
  current.current = rest
  const scheduled = useRef(false)

  useEffect(() => {
    const onChange = () => {
      if (!pushEnabledFlag()) return
      const r = current.current
      if (document.visibilityState === 'hidden') {
        if (r && r.endsAt - Date.now() > MIN_AHEAD_MS) {
          scheduleRestAlarm(userId, r.endsAt, r.next)
          scheduled.current = true
        }
      } else if (scheduled.current) {
        cancelRestAlarm(userId)
        scheduled.current = false
      }
    }
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [userId])
}
