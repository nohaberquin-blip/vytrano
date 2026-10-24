import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useUnit } from '../../app/units'
import { db } from '../../data/db'
import { getActiveProgram } from '../../data/programs'
import { useLive } from '../../data/useLive'
import {
  abandonWorkout, addSet, finishWorkout, getInProgress, lastDoneDayId, lastSetsFor, setsOf, startWorkout, updateSet,
} from '../../data/workouts'
import { nextDay } from '../../domain/rotation'
import { loadCalendarInput } from '../../data/calendar'
import { buildCalendar, toISODate } from '../../domain/calendar'
import type { Workout, WorkoutSet } from '../../domain/types'
import { useUserId } from '../auth/AuthProvider'
import { METHOD_LABELS, readTemplate, templateSummary } from '../../domain/methods'
import type { ProgramDayExercise, UserExercise } from '../../domain/types'

/** Nom de la méthode utilisée (celle du jour, sinon celle de la fiche) ; rien pour une fiche classique. */
function methodLabel(item: ProgramDayExercise | undefined, fiche: UserExercise | undefined): string | undefined {
  const t = readTemplate(item?.template ?? fiche?.template, { sets: fiche?.sets ?? 3, target_reps: fiche?.target_reps ?? 10 })
  return t.method === 'classic' ? undefined : METHOD_LABELS[t.method]
}
import { ExerciseCard } from './ExerciseCard'
import { useRest } from './RestProvider'
import { readRestSettings, useRestSettings } from './restSettings'
import { unlockAudio } from './beep'
import { restSeconds } from '../../domain/rest'
import { useWakeLock } from './useWakeLock'
import { TimeLimit } from './TimeLimit'

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
  // Temps disponible : facultatif, jamais retenu d'une séance à l'autre.
  const [minutes, setMinutes] = useState<number | null>(null)
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
    const today = toISODate(new Date())
    const calendar = await loadCalendarInput(userId, today)
    const restDay = !!calendar && buildCalendar(calendar, today, today)[0].state === 'rest'
    return { tree, day, rows, restDay }
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
  const { tree, day, rows, restDay } = data
  return (
    <section className="page">
      {justFinished && <div className="banner">Séance enregistrée 💪 Les charges ont été mises à jour.</div>}
      <p className="muted small" style={{ margin: 0 }}>{tree.program.name}</p>
      <h1>{day ? day.name : 'Séance'}</h1>
      {restDay && <p className="muted">Jour de repos aujourd'hui</p>}
      {!day && <p className="empty">Ce programme n’a pas encore de jour. <Link to="/programmes">Le compléter</Link></p>}
      {day && rows!.length === 0 && <p className="empty">Aucun exercice dans ce jour. <Link to="/programmes">Ajouter des exercices</Link></p>}
      {day && rows!.length > 0 && (
        <>
          <ul className="list">
            {rows!.map(({ item, exercise, fiche }) => (
              <li key={item.id} className="list-item" style={{ cursor: 'default' }}>
                <span>{exercise?.name ?? '…'}</span>
                <span className="muted small num">
                  {fiche ? `${templateSummary(readTemplate(item.template ?? fiche.template, fiche))} · ${show(fiche.current_weight)}` : ''}
                </span>
              </li>
            ))}
          </ul>
          <button className="btn primary block big" style={{ marginTop: 12 }} onClick={() => startWorkout(userId, day, minutes)}>
            Commencer
          </button>
          <TimeLimit day={day} minutes={minutes} onChange={setMinutes} />
        </>
      )}
      {tree.days.length > 1 && <OtherDays minutes={minutes} />}
    </section>
  )
}

/** Permet de faire un autre jour que celui proposé. */
function OtherDays({ minutes }: { minutes: number | null }) {
  const userId = useUserId()
  const [open, setOpen] = useState(false)
  const tree = useLive(() => getActiveProgram(userId), [userId])
  if (!tree) return null
  return (
    <div style={{ marginTop: 20 }}>
      <button className="btn ghost block" onClick={() => setOpen(!open)}>{open ? 'Masquer' : 'Faire un autre jour'}</button>
      {open && tree.days.map((d) => (
        <button key={d.id} className="list-item" onClick={() => startWorkout(userId, d, minutes)}>
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
    item: workout.program_day_id
      ? await db.program_day_exercises.where('day_id').equals(workout.program_day_id).filter((d) => d.exercise_id === id).first()
      : undefined,
  }))), [userId, exerciseIds.join(), workout.program_day_id])

  const remaining = sets.filter((s) => !s.done).length
  const timer = useRest()
  const [settings] = useRestSettings()
  useWakeLock(settings.wakeLock)
  const { show } = useUnit()

  /** Séries de la séance dans l'ordre affiché : exercices dans l'ordre des cartes, séries par position. */
  function ordered(list: WorkoutSet[]): WorkoutSet[] {
    const ids = [...new Set([...(meta ?? []).map((m) => m.id), ...list.map((s) => s.exercise_id)])]
    return ids.flatMap((id) => list.filter((s) => s.exercise_id === id).sort((a, b) => a.position - b.position))
  }

  /** Série suivante à faire : la suite du même exercice, puis les exercices suivants, puis ce qui reste. */
  function nextAfter(done: WorkoutSet, list: WorkoutSet[]): WorkoutSet | undefined {
    const i = list.findIndex((s) => s.id === done.id)
    return [...list.slice(i + 1), ...list.slice(0, i)].find((s) => !s.done)
  }

  function label(s: WorkoutSet, list: WorkoutSet[]): string {
    const m = meta?.find((x) => x.id === s.exercise_id)
    const rank = list.filter((x) => x.exercise_id === s.exercise_id && x.position <= s.position).length
    return `${m?.name ?? '…'} · série ${rank} · ${show(s.weight)} × ${s.target_reps ?? 'max'}`
  }

  async function update(s: WorkoutSet) {
    const before = sets.find((x) => x.id === s.id)
    const becameDone = !!before && !before.done && s.done
    if (becameDone) unlockAudio() // pendant le toucher : condition du son sur iPhone
    if (before?.done && !s.done && timer.rest?.setId === s.id) timer.stop()
    await updateSet(s)
    if (!becameDone || !readRestSettings().auto) return
    // État réellement enregistré : l'affichage peut avoir un temps de retard si on valide vite.
    const list = ordered(await setsOf(workout.id))
    const saved = list.find((x) => x.id === s.id) ?? s
    const next = nextAfter(saved, list)
    const fiche = meta?.find((m) => m.id === s.exercise_id)?.fiche
    const seconds = restSeconds(saved, next, fiche)
    if (seconds !== null && next) timer.start(s.id, seconds, label(next, list))
    else if (timer.rest) timer.stop() // plus rien à faire : l'ancien repos annoncerait une série déjà faite
  }

  async function finish() {
    if (remaining > 0 && !confirm(`${remaining} série${remaining > 1 ? 's' : ''} non validée${remaining > 1 ? 's' : ''}. Terminer quand même ?`)) return
    // Posé avant : l'écran suivant s'affiche dès que la séance passe à « terminée ».
    sessionStorage.setItem('muscu.finished', '1')
    timer.stop()
    await finishWorkout(workout.id)
  }

  async function abandon() {
    if (!confirm('Abandonner cette séance ? Elle ne sera pas enregistrée.')) return
    timer.stop()
    await abandonWorkout(workout.id)
  }

  return (
    <section className="page">
      <p className="muted small num" style={{ margin: 0 }}>En cours · {minutes} min</p>
      <h1>{workout.name}</h1>
      {workout.time_limit ? <p className="muted small" style={{ marginTop: -8 }}>Séance adaptée à {workout.time_limit} min</p> : null}
      {meta?.map((m) => (
        <ExerciseCard key={m.id} name={m.name} last={m.last} targetWeight={m.fiche?.current_weight}
          methodLabel={methodLabel(m.item, m.fiche)}
          sets={sets.filter((s) => s.exercise_id === m.id)}
          onUpdate={(s) => void update(s)} onAddSet={() => addSet(workout.id, m.id)} />
      ))}
      <button className="btn primary block big" onClick={finish}>Terminer la séance</button>
      <button className="btn ghost block" style={{ marginTop: 8, color: 'var(--danger)' }} onClick={abandon}>Abandonner</button>
    </section>
  )
}
