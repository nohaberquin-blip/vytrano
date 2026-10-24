import { useEffect, useRef, useState } from 'react'
import { setWeeklyGoal } from '../../data/calendar'
import { weekProgress, type CalendarDay, type CalendarInput } from '../../domain/calendar'
import { useUserId } from '../auth/AuthProvider'
import { STATE_LABELS, longDate, shortDay } from './format'

/** Texte principal d'un jour dans la liste de la semaine. */
export function dayText(d: CalendarDay): string {
  switch (d.state) {
    case 'planned': return d.day?.name ?? 'Séance libre'
    case 'done': return d.workouts.map((w) => w.name).join(' + ')
    case 'missed': return 'Manquée'
    case 'moved': return `Reportée → ${shortDay(d.movedTo!)}`
    default: return 'Repos'
  }
}

export function WeekView({ monday, cal, input, exercises, onPick }: {
  monday: string
  cal: CalendarDay[]
  input: CalendarInput
  /** Noms des exercices par jour de programme. */
  exercises: Map<string, string[]>
  onPick(day: CalendarDay): void
}) {
  const userId = useUserId()
  const [editing, setEditing] = useState(false)
  const p = weekProgress(input, monday)
  // Dernière valeur demandée : des appuis rapides s'enchaînent sans attendre que l'écran suive.
  const requested = useRef<number | null>(null)
  useEffect(() => { requested.current = null }, [monday])
  useEffect(() => { if (p.goal === requested.current) requested.current = null }, [p.goal])
  const set = (n: number | null) => {
    if (n === null) requested.current = null
    return setWeeklyGoal(userId, monday, n)
  }
  const bump = (delta: number) => {
    const next = Math.min(14, Math.max(0, (requested.current ?? p.goal) + delta))
    requested.current = next
    return setWeeklyGoal(userId, monday, next)
  }

  return (
    <div>
      <button className={p.reached ? 'goal reached' : 'goal'} onClick={() => setEditing(!editing)}>
        Objectif : {p.done}/{p.goal} séances
      </button>
      {editing && (
        <div className="row goal-editor">
          <button className="btn icon" aria-label="Diminuer l'objectif" onClick={() => bump(-1)}>−</button>
          <span className="num">{p.goal}</span>
          <button className="btn icon" aria-label="Augmenter l'objectif" onClick={() => bump(1)}>＋</button>
          <button className="btn ghost small" onClick={() => set(null)}>Par défaut</button>
        </div>
      )}
      <div className="cal-week">
        {cal.map((d) => (
          <button key={d.date} aria-label={`${longDate(d.date)}, ${STATE_LABELS[d.state]}`}
            className={['cal-row', `cal-${d.state}`, d.date === input.today && 'today'].filter(Boolean).join(' ')}
            onClick={() => onPick(d)}>
            <span className="cal-row-date muted small">{shortDay(d.date)}</span>
            <span className="cal-dot" aria-hidden />
            <span className="cal-row-main">
              <span>{dayText(d)}</span>
              {d.state === 'planned' && d.day && (
                <span className="muted small">{(exercises.get(d.day.id) ?? []).join(' · ')}</span>
              )}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
