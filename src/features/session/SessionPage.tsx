import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useUnit } from '../../app/units'
import { db } from '../../data/db'
import { getActiveProgram } from '../../data/programs'
import { useLive } from '../../data/useLive'
import {
  abandonWorkout, addSet, finishWorkout, getInProgress, lastDoneDayId, lastSetsFor, startWorkout, updateSet,
} from '../../data/workouts'
import { nextDay } from '../../domain/rotation'
import type { Workout, WorkoutSet } from '../../domain/types'
import { useUserId } from '../auth/AuthProvider'
import { ExerciseCard } from './ExerciseCard'

export function SessionPage() {
  const userId = useUserId()
  const current = useLive(() => getInProgress(userId), [userId])
  if (current === undefined) return null
  return current ? <ActiveWorkout workout={current.workout} sets={current.sets} /> : <NextWorkout />
}

function NextWorkout() {
  const userId = useUserId()
  const { show } = useUnit()
  const [justFinished] = useState(() => sessionStorage.getItem('muscu.finished'))
  useEffect(() => { sessionStorage.removeItem('muscu.finished') }, [])

  const data = useLive(async () => {
    const tree = await getActiveProgram(userId)
    if (!tree) return { tree: null }
    const day = nextDay(tree.days, await lastDoneDayId(userId))
    const items = day ? tree.exercisesByDay.get(day.id) ?? [] : []
    const rows = await Promise.all(items.map(async (it) => ({
      item: it,
      exercise: await db.exercises.get(it.exercise_id),
      fiche: await db.user_exercises.where('exercise_id').equals(it.exercise_id).filter((f) => f.user_id === userId).first(),
    })))
    return { tree, day, rows }
  }, [userId])

  if (!data) return null
  if (!data.tree) {
    return (
      <section className="page">
        <h1>Séance</h1>
        <div className="empty">
          <p>Aucun programme actif.</p>
          <Link className="btn primary" to="/programmes?nouveau=1">Créer un programme</Link>
        </div>
      </section>
    )
  }
  const { tree, day, rows } = data
  return (
    <section className="page">
      {justFinished && <div className="banner">Séance enregistrée 💪 Les charges ont été mises à jour.</div>}
      <p className="muted small" style={{ margin: 0 }}>{tree.program.name}</p>
      <h1>{day ? day.name : 'Séance'}</h1>
      {!day && <p className="empty">Ce programme n’a pas encore de jour. <Link to="/programmes">Le compléter</Link></p>}
      {day && rows!.length === 0 && <p className="empty">Aucun exercice dans ce jour. <Link to="/programmes">Ajouter des exercices</Link></p>}
      {day && rows!.length > 0 && (
        <>
          <ul className="list">
            {rows!.map(({ item, exercise, fiche }) => (
              <li key={item.id} className="list-item" style={{ cursor: 'default' }}>
                <span>{exercise?.name ?? '…'}</span>
                <span className="muted small num">{fiche ? `${fiche.sets} × ${fiche.target_reps} · ${show(fiche.current_weight)}` : ''}</span>
              </li>
            ))}
          </ul>
          <button className="btn primary block big" style={{ marginTop: 12 }} onClick={() => startWorkout(userId, day)}>
            Commencer
          </button>
        </>
      )}
      {tree.days.length > 1 && <OtherDays />}
    </section>
  )
}

/** Permet de faire un autre jour que celui proposé. */
function OtherDays() {
  const userId = useUserId()
  const [open, setOpen] = useState(false)
  const tree = useLive(() => getActiveProgram(userId), [userId])
  if (!tree) return null
  return (
    <div style={{ marginTop: 20 }}>
      <button className="btn ghost block" onClick={() => setOpen(!open)}>{open ? 'Masquer' : 'Faire un autre jour'}</button>
      {open && tree.days.map((d) => (
        <button key={d.id} className="list-item" onClick={() => startWorkout(userId, d)}>
          <span>{d.name}</span><span className="muted">Commencer ›</span>
        </button>
      ))}
    </div>
  )
}

function useElapsed(since: string) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])
  return Math.max(0, Math.round((now - new Date(since).getTime()) / 60_000))
}

function ActiveWorkout({ workout, sets }: { workout: Workout; sets: WorkoutSet[] }) {
  const userId = useUserId()
  const minutes = useElapsed(workout.started_at)
  const exerciseIds = [...new Set(sets.map((s) => s.exercise_id))]
  const meta = useLive(async () => Promise.all(exerciseIds.map(async (id) => ({
    id,
    name: (await db.exercises.get(id))?.name ?? '…',
    last: await lastSetsFor(userId, id),
    fiche: await db.user_exercises.where('exercise_id').equals(id).filter((f) => f.user_id === userId).first(),
  }))), [userId, exerciseIds.join()])

  const remaining = sets.filter((s) => !s.done).length

  async function finish() {
    if (remaining > 0 && !confirm(`${remaining} série${remaining > 1 ? 's' : ''} non validée${remaining > 1 ? 's' : ''}. Terminer quand même ?`)) return
    // Posé avant : l'écran suivant s'affiche dès que la séance passe à « terminée ».
    sessionStorage.setItem('muscu.finished', '1')
    await finishWorkout(workout.id)
  }

  async function abandon() {
    if (confirm('Abandonner cette séance ? Elle ne sera pas enregistrée.')) await abandonWorkout(workout.id)
  }

  return (
    <section className="page">
      <p className="muted small num" style={{ margin: 0 }}>En cours · {minutes} min</p>
      <h1>{workout.name}</h1>
      {meta?.map((m) => (
        <ExerciseCard key={m.id} name={m.name} last={m.last} targetWeight={m.fiche?.current_weight}
          sets={sets.filter((s) => s.exercise_id === m.id)}
          onUpdate={(s) => updateSet(s)} onAddSet={() => addSet(workout.id, m.id)} />
      ))}
      <button className="btn primary block big" onClick={finish}>Terminer la séance</button>
      <button className="btn ghost block" style={{ marginTop: 8, color: 'var(--danger)' }} onClick={abandon}>Abandonner</button>
    </section>
  )
}
