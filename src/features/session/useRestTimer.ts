import { useEffect, useRef, useState } from 'react'
import { playBeeps } from './beep'
import { readRestSettings } from './restSettings'

/** Repos en cours : l'heure de fin est gardée (et non un compte à rebours) pour survivre au verrouillage. */
export interface RestState { workoutId: string; setId: string; endsAt: number; total: number; next: string }

const KEY = 'vytrano.rest'
/** Au-delà, la fin est trop ancienne pour sonner (retour dans l'app longtemps après). */
const LATE_SIGNAL_MS = 3000

export function readRest(): RestState | null {
  try { return JSON.parse(localStorage.getItem(KEY) ?? 'null') } catch { return null }
}

export function writeRest(r: RestState | null) {
  try {
    if (r) localStorage.setItem(KEY, JSON.stringify(r))
    else localStorage.removeItem(KEY)
  } catch { /* stockage indisponible : le repos ne survit pas au rechargement */ }
}

export interface RestTimer {
  rest: RestState | null
  /** Secondes restantes (arrondies au-dessus) ; 0 une fois fini. */
  remaining: number
  /** Secondes écoulées depuis la fin. */
  overtime: number
  start(setId: string, seconds: number, next: string): void
  adjust(deltaSeconds: number): void
  stop(): void
}

/**
 * `workoutId` : séance en cours ; null = aucune (le repos est effacé) ; undefined = pas encore connue.
 */
export function useRestTimer(workoutId: string | null | undefined): RestTimer {
  const [rest, setRestState] = useState<RestState | null>(() => {
    const r = readRest()
    if (r && workoutId !== undefined && r.workoutId !== workoutId) { writeRest(null); return null }
    return r
  })
  const [now, setNow] = useState(Date.now)
  const signaled = useRef<string | null>(null)

  const setRest = (r: RestState | null) => { writeRest(r); setRestState(r); setNow(Date.now()) }

  // Séance terminée, abandonnée ou remplacée : son repos n'a plus de sens.
  useEffect(() => {
    if (workoutId !== undefined && rest && rest.workoutId !== workoutId) setRest(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workoutId, rest])

  useEffect(() => {
    if (!rest) return
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [rest])

  // Un seul signal par fin de repos ; pas de signal pour une fin trop ancienne.
  useEffect(() => {
    if (!rest || now < rest.endsAt) return
    const key = `${rest.setId}:${rest.endsAt}`
    if (signaled.current === key) return
    signaled.current = key
    if (now - rest.endsAt > LATE_SIGNAL_MS) return
    const settings = readRestSettings()
    if (settings.sound) playBeeps()
    if (settings.vibrate) navigator.vibrate?.([300, 100, 300])
  }, [rest, now])

  return {
    rest,
    remaining: rest ? Math.max(0, Math.ceil((rest.endsAt - now) / 1000)) : 0,
    overtime: rest ? Math.max(0, Math.floor((now - rest.endsAt) / 1000)) : 0,
    start(setId, seconds, next) {
      if (!workoutId) return
      const t = Date.now()
      setRest({ workoutId, setId, endsAt: t + seconds * 1000, total: seconds, next })
    },
    adjust(delta) {
      if (!rest) return
      const t = Date.now()
      const endsAt = Math.max(t + 5000, rest.endsAt + delta * 1000)
      setRest({ ...rest, endsAt, total: Math.max(rest.total + delta, Math.ceil((endsAt - t) / 1000)) })
    },
    stop() { setRest(null) },
  }
}
