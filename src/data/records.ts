import { exerciseRecords, setRecords, type Best, type RecordKind, type SessionSets, oneRepMax } from '../domain/records'
import type { Workout, WorkoutSet } from '../domain/types'
import { db } from './db'

const byStart = (a: SessionSets, b: SessionSets) => a.workout.started_at.localeCompare(b.workout.started_at)

/** Séances terminées et non allégées de l'utilisateur, avec leurs séries groupées par exercice (un seul passage). */
async function historyByExercise(userId: string): Promise<Map<string, SessionSets[]>> {
  const done = await db.workouts.where('user_id').equals(userId).filter((w) => w.status === 'done').toArray()
  const light = new Set((await db.workout_lightenings.bulkGet(done.map((w) => w.id))).filter((l) => l).map((l) => l!.id))
  const workouts = new Map(done.filter((w) => !light.has(w.id)).map((w) => [w.id, w]))
  const sets = await db.workout_sets.where('workout_id').anyOf([...workouts.keys()]).toArray()
  const grouped = new Map<string, Map<string, WorkoutSet[]>>()
  for (const s of sets) {
    const byWorkout = grouped.get(s.exercise_id) ?? new Map<string, WorkoutSet[]>()
    byWorkout.set(s.workout_id, [...(byWorkout.get(s.workout_id) ?? []), s])
    grouped.set(s.exercise_id, byWorkout)
  }
  return new Map([...grouped].map(([exerciseId, byWorkout]) => [
    exerciseId,
    [...byWorkout].map(([wid, list]) => ({ workout: workouts.get(wid) as Workout, sets: list })).sort(byStart),
  ]))
}

/** Historique d'un exercice (séances terminées, non allégées), dans l'ordre chronologique. */
export async function historyFor(userId: string, exerciseId: string): Promise<SessionSets[]> {
  return (await historyByExercise(userId)).get(exerciseId) ?? []
}

/** Records battus dans la séance en cours, série par série (aucun pour une séance allégée). */
export async function liveRecords(userId: string, workoutId: string): Promise<Map<string, RecordKind[]>> {
  if (await db.workout_lightenings.get(workoutId)) return new Map()
  const current = await db.workout_sets.where('workout_id').equals(workoutId).toArray()
  const history = await historyByExercise(userId)
  const out = new Map<string, RecordKind[]>()
  for (const exerciseId of new Set(current.map((s) => s.exercise_id))) {
    const previous = (history.get(exerciseId) ?? []).filter((h) => h.workout.id !== workoutId)
    for (const [id, kinds] of setRecords(previous, current.filter((s) => s.exercise_id === exerciseId))) out.set(id, kinds)
  }
  return out
}

export interface RecordSummary { exerciseId: string; name: string; kinds: RecordKind[]; weight: number; e1rm: number }

/** Récapitulatif de fin de séance : par exercice, les records battus et la meilleure valeur atteinte. */
export async function sessionRecordSummary(userId: string, workoutId: string): Promise<RecordSummary[]> {
  const records = await liveRecords(userId, workoutId)
  if (records.size === 0) return []
  const sets = (await db.workout_sets.bulkGet([...records.keys()])).filter((s): s is WorkoutSet => !!s)
  const out = new Map<string, RecordSummary>()
  for (const s of sets.sort((a, b) => a.position - b.position)) {
    const r = out.get(s.exercise_id) ?? { exerciseId: s.exercise_id, name: '', kinds: [], weight: 0, e1rm: 0 }
    for (const k of records.get(s.id)!) if (!r.kinds.includes(k)) r.kinds.push(k)
    r.weight = Math.max(r.weight, s.weight)
    r.e1rm = Math.max(r.e1rm, oneRepMax(s))
    out.set(s.exercise_id, r)
  }
  const list = [...out.values()]
  const names = await db.exercises.bulkGet(list.map((r) => r.exerciseId))
  list.forEach((r, i) => { r.name = names[i]?.name ?? '…'; r.kinds.sort() })
  return list
}

export interface ExerciseRecord { exerciseId: string; name: string; weight: Best; e1rm: Best; lastRecord: string }

/** Tous les records, par exercice, du plus récent au plus ancien. */
export async function allRecords(userId: string): Promise<ExerciseRecord[]> {
  const out: ExerciseRecord[] = []
  for (const [exerciseId, history] of await historyByExercise(userId)) {
    const r = exerciseRecords(history)
    if (!r.weight || !r.e1rm) continue
    const latest = [r.lastRecord, r.weight.date, r.e1rm.date].filter((d): d is string => !!d).sort().at(-1)!
    out.push({ exerciseId, name: '', weight: r.weight, e1rm: r.e1rm, lastRecord: latest })
  }
  const names = await db.exercises.bulkGet(out.map((r) => r.exerciseId))
  out.forEach((r, i) => { r.name = names[i]?.name ?? '…' })
  return out.sort((a, b) => b.lastRecord.localeCompare(a.lastRecord))
}
