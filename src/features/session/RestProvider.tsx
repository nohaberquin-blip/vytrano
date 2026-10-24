import { createContext, useContext, type ReactNode } from 'react'
import { useLive } from '../../data/useLive'
import { db } from '../../data/db'
import { useUserId } from '../auth/AuthProvider'
import { RestBar } from './RestBar'
import { useRestAlarm } from './useRestAlarm'
import { useRestTimer, type RestTimer } from './useRestTimer'

const RestContext = createContext<RestTimer | null>(null)

/** Le repos vit au niveau de l'app : il continue (bip, alerte) quel que soit l'onglet ouvert. */
export function RestProvider({ children }: { children: ReactNode }) {
  const userId = useUserId()
  const workoutId = useLive(async () => {
    const w = await db.workouts.where('user_id').equals(userId).filter((x) => x.status === 'in_progress').first()
    return w?.id ?? null
  }, [userId])
  const timer = useRestTimer(workoutId)
  useRestAlarm(userId, timer.rest)
  return <RestContext.Provider value={timer}>{children}</RestContext.Provider>
}

export function useRest(): RestTimer {
  const timer = useContext(RestContext)
  if (!timer) throw new Error('useRest hors de RestProvider')
  return timer
}

/** Barre de repos affichée sur tous les onglets. */
export function GlobalRestBar() {
  const timer = useRest()
  return timer.rest ? <RestBar {...timer} /> : null
}
