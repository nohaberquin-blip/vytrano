import { useEffect, useState } from 'react'
import { loadMonthData } from '../data/challenges'
import { db } from '../data/db'
import { useLive } from '../data/useLive'
import { addDays, toISODate, workoutDate } from '../domain/calendar'
import { MonthReport } from '../features/calendar/MonthReport'
import { useUserId } from '../features/auth/AuthProvider'

const key = (userId: string) => `vytrano.report.${userId}`
function shown(userId: string): string | null {
  try { return localStorage.getItem(key(userId)) } catch { return null }
}
function markShown(userId: string, ym: string) {
  try { localStorage.setItem(key(userId), ym) } catch { /* stockage indisponible : le bilan se rouvrira */ }
}

/** Bilan du mois précédent, ouvert une seule fois par mois et par appareil, s'il y a eu des séances. */
export function MonthReportAuto() {
  const userId = useUserId()
  const today = toISODate(new Date())
  const ym = addDays(`${today.slice(0, 7)}-01`, -1).slice(0, 7)
  const [closed, setClosed] = useState(() => shown(userId) === ym)
  // Déclencheur léger : tout l'historique n'est chargé que s'il y a un bilan à montrer.
  const due = useLive(async () => !closed && !!(await db.workouts.where('user_id').equals(userId)
    .filter((w) => w.status === 'done' && workoutDate(w).startsWith(ym)).first()), [userId, ym, closed])
  const data = useLive(() => (due ? loadMonthData(userId, today) : Promise.resolve(null)), [userId, today, due])
  const visible = !closed && !!due && !!data
  // Noté dès l'affichage : recharger l'app ne le rouvre pas.
  useEffect(() => { if (visible) markShown(userId, ym) }, [visible, userId, ym])
  if (!visible) return null
  return <MonthReport ym={ym} data={data} onClose={() => setClosed(true)} />
}
