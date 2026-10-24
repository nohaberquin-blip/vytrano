import { buildWorkoutSets } from '../domain/buildWorkout'
import { nextWeight } from '../domain/progression'
import type { ProgramDay, Workout, WorkoutSet } from '../domain/types'
import { db } from './db'
import { ensureFiche, repo } from './repo'

const byPosition = (a: WorkoutSet, b: WorkoutSet) => a.position - b.position

export async function setsOf(workoutId: string): Promise<WorkoutSet[]> {
  return (await db.workout_sets.where('workout_id').equals(workoutId).toArray()).sort(byPosition)
}

export async function getInProgress(userId: string): Promise<{ workout: Workout; sets: WorkoutSet[] } | null> {
  const workout = (await db.workouts.where('user_id').equals(userId).filter((w) => w.status === 'in_progress').toArray())
    .sort((a, b) => b.started_at.localeCompare(a.started_at))[0]
  return workout ? { workout, sets: await setsOf(workout.id) } : null
}

export async function startWorkout(userId: string, day: ProgramDay): Promise<Workout> {
  const dayExercises = await db.program_day_exercises.where('day_id').equals(day.id).toArray()
  const fiches = new Map(
    (await Promise.all(dayExercises.map((de) => ensureFiche(userId, de.exercise_id)))).map((f) => [f.exercise_id, f]),
  )
  const workout = await repo.put<Workout>('workouts', {
    id: crypto.randomUUID(), user_id: userId, program_day_id: day.id, name: day.name,
    started_at: new Date().toISOString(), finished_at: null, status: 'in_progress',
  })
  for (const s of buildWorkoutSets(workout.id, dayExercises, fiches)) await repo.put('workout_sets', s)
  return workout
}

export async function updateSet(set: WorkoutSet): Promise<void> {
  await repo.put('workout_sets', set)
}

/** Ajoute une série à la fin d'un exercice, copiée sur la dernière de cet exercice. */
export async function addSet(workoutId: string, exerciseId: string): Promise<void> {
  const sets = await setsOf(workoutId)
  const mine = sets.filter((s) => s.exercise_id === exerciseId)
  const model = mine[mine.length - 1]
  if (!model) return
  // On décale les séries des exercices suivants pour garder l'ordre.
  for (const s of sets.filter((s) => s.position > model.position)) await repo.put('workout_sets', { ...s, position: s.position + 1 })
  await repo.put<WorkoutSet>('workout_sets', { ...model, id: crypto.randomUUID(), position: model.position + 1, done: false })
}

export async function finishWorkout(workoutId: string): Promise<void> {
  const workout = await db.workouts.get(workoutId)
  if (!workout) return
  const sets = await setsOf(workoutId)
  await repo.put('workouts', { ...workout, status: 'done', finished_at: new Date().toISOString() })
  for (const exerciseId of new Set(sets.map((s) => s.exercise_id))) {
    const fiche = await ensureFiche(workout.user_id, exerciseId)
    const weight = nextWeight(fiche, sets.filter((s) => s.exercise_id === exerciseId))
    if (weight !== fiche.current_weight) await repo.put('user_exercises', { ...fiche, current_weight: weight })
  }
}

export async function abandonWorkout(workoutId: string): Promise<void> {
  // Le serveur supprime les séries en cascade.
  await db.workout_sets.where('workout_id').equals(workoutId).delete()
  await repo.remove('workouts', workoutId)
}

/** Séances terminées contenant l'exercice, les plus récentes d'abord, avec leurs séries validées. */
export async function exerciseHistory(userId: string, exerciseId: string, limit: number) {
  const sets = await db.workout_sets.where('exercise_id').equals(exerciseId).toArray()
  const byWorkout = new Map<string, WorkoutSet[]>()
  for (const s of sets) byWorkout.set(s.workout_id, [...(byWorkout.get(s.workout_id) ?? []), s])
  const workouts = (await db.workouts.bulkGet([...byWorkout.keys()]))
    .filter((w): w is Workout => !!w && w.status === 'done' && w.user_id === userId)
    .sort((a, b) => (b.finished_at ?? '').localeCompare(a.finished_at ?? ''))
    .slice(0, limit)
  return workouts.map((w) => ({ workout: w, sets: byWorkout.get(w.id)!.sort(byPosition) }))
}

export async function lastSetsFor(userId: string, exerciseId: string): Promise<WorkoutSet[]> {
  return (await exerciseHistory(userId, exerciseId, 1))[0]?.sets ?? []
}

export async function lastDoneDayId(userId: string): Promise<string | null> {
  const done = await db.workouts.where('user_id').equals(userId).filter((w) => w.status === 'done').toArray()
  done.sort((a, b) => (b.finished_at ?? '').localeCompare(a.finished_at ?? ''))
  return done[0]?.program_day_id ?? null
}
