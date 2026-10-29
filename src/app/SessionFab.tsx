import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useLive } from '../data/useLive'
import { db } from '../data/db'
import { useAuth, useUserId } from '../features/auth/AuthProvider'
import { readLayout } from '../domain/home'

/** Raccourci vers la séance en cours, sauf sur la Séance et sur l'accueil où la tuile Séances l'affiche déjà. */
export function SessionFab() {
  const userId = useUserId()
  const { pathname } = useLocation()
  const { profile } = useAuth()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])
  const workout = useLive(
    () => db.workouts.where('user_id').equals(userId).filter((w) => w.status === 'in_progress').first(),
    [userId],
  )
  const tileShown = pathname === '/' && !readLayout(profile?.home).hiddenApps.includes('session')
  if (!workout || pathname === '/seance' || tileShown) return null
  const minutes = Math.max(0, Math.floor((now - Date.parse(workout.started_at)) / 60_000))
  return (
    <Link to="/seance" className="session-fab" aria-label={`Reprendre la séance, ${minutes} min`}>
      <span aria-hidden>▶</span> {minutes} min
    </Link>
  )
}
