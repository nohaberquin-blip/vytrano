import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sheet } from '../../app/Sheet'
import { useUnit } from '../../app/units'
import { addSession, cancelMove, moveSession, setRest } from '../../data/calendar'
import { removePeriod, setPeriodDays, showsLightened, startPeriod } from '../../data/cycle'
import { db } from '../../data/db'
import { useLive } from '../../data/useLive'
import { setsOf, startWorkout } from '../../data/workouts'
import { addDays, buildCalendar, type CalendarDay, type CalendarInput } from '../../domain/calendar'
import { PERIOD_DAYS, PERIOD_MAX, PERIOD_MIN, periodOn } from '../../domain/cycle'
import type { Period, Workout } from '../../domain/types'
import { useUserId } from '../auth/AuthProvider'
import { longDate, shortDay } from './format'

/** Détail d'un jour : contenu et actions selon son état. */
export function DaySheet({ day, input, exercises, periods, onClose }: {
  day: CalendarDay
  input: CalendarInput
  exercises: Map<string, string[]>
  /** Règles notées ; null = mode absent (profil non « Femme »). */
  periods: Period[] | null
  onClose(): void
}) {
  const userId = useUserId()
  const navigate = useNavigate()
  const [moving, setMoving] = useState(false)
  const { today } = input
  const title = longDate(day.date)
  const [busy, setBusy] = useState(false)
  // Une action à la fois : un double appui n'écrit pas deux fois.
  const run = (action: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    action().then(onClose, () => setBusy(false))
  }

  async function start() {
    await startWorkout(userId, day.day!)
    navigate('/seance')
  }

  if (moving) {
    // Seulement des jours de repos : déplacer sur un jour déjà prévu fusionnerait deux séances.
    const targets = buildCalendar(input, today, addDays(today, 13)).filter((d) => d.state === 'rest')
    return (
      <Sheet title={title} onClose={onClose}>
        <p className="muted">Déplacer la séance au :</p>
        <div className="move-targets">
          {targets.map((d) => (
            <button key={d.date} className="btn" disabled={busy} aria-label={longDate(d.date)} onClick={() => run(() => moveSession(userId, day.date, d.date))}>
              {shortDay(d.date)}
            </button>
          ))}
        </div>
        <button className="btn ghost block" onClick={() => setMoving(false)}>Retour</button>
      </Sheet>
    )
  }

  return (
    <Sheet title={title} onClose={onClose}>
      {day.state === 'planned' && (
        <>
          <p className="card-title">{day.day?.name ?? 'Séance libre'}</p>
          {day.day && <p className="muted small">{(exercises.get(day.day.id) ?? []).join(' · ') || 'Aucun exercice'}</p>}
          {day.date === today && day.day && <button className="btn primary block" onClick={start}>Commencer</button>}
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn" style={{ flex: 1 }} onClick={() => setMoving(true)}>Déplacer</button>
            <button className="btn" style={{ flex: 1 }} disabled={busy} onClick={() => run(() => setRest(userId, day.date))}>Passer en repos</button>
          </div>
        </>
      )}
      {day.state === 'rest' && (day.date >= today
        ? <button className="btn block" disabled={busy} onClick={() => run(() => addSession(userId, day.date))}>Ajouter une séance ce jour</button>
        : <p className="muted">Jour de repos</p>)}
      {day.state === 'missed' && <p className="muted">Séance manquée — elle a glissé au prochain jour d'entraînement</p>}
      {day.state === 'moved' && (
        <>
          <p>Séance déplacée au {longDate(day.movedTo!)}</p>
          <button className="btn block" disabled={busy} onClick={() => run(() => cancelMove(userId, day.date))}>Annuler le report</button>
        </>
      )}
      {day.state === 'done' && day.workouts.map((w) => <DoneWorkout key={w.id} workout={w} />)}
      {periods && <PeriodSection date={day.date} today={today} periods={periods} busy={busy} run={run} />}
    </Sheet>
  )
}

/** Règles : noter un début (jusqu'à aujourd'hui), ou modifier / supprimer la période qui couvre ce jour. */
function PeriodSection({ date, today, periods, busy, run }: {
  date: string
  today: string
  periods: Period[]
  busy: boolean
  run(action: () => Promise<void>): void
}) {
  const userId = useUserId()
  const current = periodOn(date, periods)
  const [text, setText] = useState(String(current?.days ?? PERIOD_DAYS))
  if (!current && date > today) return null
  const days = /^\d{1,2}$/.test(text.trim()) ? Number(text.trim()) : NaN
  const invalid = !(days >= PERIOD_MIN && days <= PERIOD_MAX)
  return (
    <div className="card period-card">
      {current && <p className="card-title">Règles</p>}
      <label className="field"><span>Durée (jours)</span>
        <input className="input num" type="number" inputMode="numeric" min={PERIOD_MIN} max={PERIOD_MAX}
          value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      {invalid && <p className="error">Entre {PERIOD_MIN} et {PERIOD_MAX} jours</p>}
      {current
        ? (
          <div className="row">
            <button className="btn" style={{ flex: 1 }} disabled={busy || invalid} onClick={() => run(() => setPeriodDays(current.id, days))}>Modifier la durée</button>
            <button className="btn danger" style={{ flex: 1 }} disabled={busy} onClick={() => run(() => removePeriod(current.id))}>Supprimer ces règles</button>
          </div>
        )
        : <button className="btn block" disabled={busy || invalid} onClick={() => run(() => startPeriod(userId, date, days))}>Début des règles</button>}
    </div>
  )
}

/** Résumé d'une séance terminée : exercices, séries validées et charge maximale. */
function DoneWorkout({ workout }: { workout: Workout }) {
  const { show } = useUnit()
  const userId = useUserId()
  const lightened = useLive(() => showsLightened(userId, workout.id), [userId, workout.id])
  const rows = useLive(async () => {
    const sets = (await setsOf(workout.id)).filter((s) => s.done)
    const ids = [...new Set(sets.map((s) => s.exercise_id))]
    return Promise.all(ids.map(async (id) => {
      const mine = sets.filter((s) => s.exercise_id === id)
      return { id, name: (await db.exercises.get(id))?.name ?? '…', count: mine.length, max: Math.max(...mine.map((s) => s.weight)) }
    }))
  }, [workout.id])
  return (
    <div className="card">
      <p className="card-title">{workout.name}</p>
      {lightened && <p className="muted small" style={{ margin: '0 0 4px' }}>Séance allégée</p>}
      {rows?.length === 0 && <p className="muted small">Aucune série validée</p>}
      {rows?.map((r) => (
        <p key={r.id} className="small num" style={{ margin: '2px 0' }}>
          {r.name} — {r.count} série{r.count > 1 ? 's' : ''} · max {show(r.max)}
        </p>
      ))}
    </div>
  )
}
