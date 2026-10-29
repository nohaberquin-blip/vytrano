import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useLive } from '../data/useLive'
import { db } from '../data/db'
import { useUserId } from '../features/auth/AuthProvider'

/** Raccourci vers la séance en cours, sur toutes les pages sauf la Séance. */
export function SessionFab() {
  const userId = useUserId()
  const { pathname } = useLocation()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])
  const workout = useLive(
    () => db.workouts.where('user_id').equals(userId).filter((w) => w.status === 'in_progress').first(),
    [userId],
  )
  if (!workout || pathname === '/seance') return null
  const minutes = Math.max(0, Math.floor((now - Date.parse(workout.started_at)) / 60_000))
  return (
    <Link to="/seance" className="session-fab" aria-label={`Reprendre la séance, ${minutes} min`}>
      <span aria-hidden>▶</span> {minutes} min
    </Link>
  )
}
