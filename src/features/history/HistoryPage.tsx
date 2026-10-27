import { useState } from 'react'
import { Link } from 'react-router-dom'
import { loadHistory } from '../../data/stats'
import { useLive } from '../../data/useLive'
import { workoutDate } from '../../domain/calendar'
import type { Workout } from '../../domain/types'
import { useUserId } from '../auth/AuthProvider'
import { monthTitle } from '../calendar/format'
import { WorkoutSheet } from './WorkoutSheet'

const minutes = (w: Workout) => (w.finished_at ? Math.round((new Date(w.finished_at).getTime() - new Date(w.started_at).getTime()) / 60_000) : 0)

/** Toutes les séances terminées, groupées par mois (mois du début de la séance). */
export function HistoryPage() {
  const userId = useUserId()
  const history = useLive(() => loadHistory(userId), [userId])
  const [open, setOpen] = useState<Workout | null>(null)
  const months = new Map<string, NonNullable<typeof history>>()
  for (const h of history ?? []) {
    const ym = workoutDate(h.workout).slice(0, 7)
    months.set(ym, [...(months.get(ym) ?? []), h])
  }
  return (
    <section className="page">
      <Link className="back-link" to="/profil">‹ Profil</Link>
      <h1>Mon historique</h1>
      {history?.length === 0 && <p className="muted">Aucune séance terminée pour l’instant.</p>}
      {[...months].map(([ym, items]) => {
        const title = monthTitle(`${ym}-01`)
        return (
          <section key={ym}>
            <h2>{title.charAt(0).toUpperCase() + title.slice(1)} · {items.length} séance{items.length > 1 ? 's' : ''}</h2>
            <ul className="list">
              {items.map(({ workout, exercises }) => (
                <li key={workout.id}>
                  <button className="list-item" onClick={() => setOpen(workout)}>
                    <span>
                      <strong>{workout.name}</strong><br />
                      <span className="muted small">
                        {new Date(workout.started_at).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                        {' · '}{exercises} exercice{exercises > 1 ? 's' : ''}
                        {' · '}{minutes(workout)} min
                      </span>
                    </span>
                    <span className="muted">›</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
      {open && <WorkoutSheet workout={open} onClose={() => setOpen(null)} />}
    </section>
  )
}
