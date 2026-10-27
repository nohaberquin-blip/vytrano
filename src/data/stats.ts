import type { GlobalStats } from '../domain/stats'
import { globalStats } from '../domain/stats'
import type { Workout } from '../domain/types'
import { db } from './db'

const doneWorkouts = (userId: string) => db.workouts.where('user_id').equals(userId).filter((w) => w.status === 'done').toArray()

/** Séances, temps et charge totale depuis le début (une lecture des séries). */
export async function loadGlobalStats(userId: string): Promise<GlobalStats> {
  const workouts = await doneWorkouts(userId)
  const sets = await db.workout_sets.where('workout_id').anyOf(workouts.map((w) => w.id)).toArray()
  return globalStats(workouts, sets)
}

/** Séances terminées, les plus récentes d'abord, avec leur nombre d'exercices (une lecture des séries). */
export async function loadHistory(userId: string): Promise<{ workout: Workout; exercises: number }[]> {
  const workouts = await doneWorkouts(userId)
  workouts.sort((a, b) => (b.finished_at ?? b.started_at).localeCompare(a.finished_at ?? a.started_at))
  const sets = await db.workout_sets.where('workout_id').anyOf(workouts.map((w) => w.id)).toArray()
  const exercises = new Map<string, Set<string>>()
  for (const s of sets) exercises.set(s.workout_id, (exercises.get(s.workout_id) ?? new Set()).add(s.exercise_id))
  return workouts.map((workout) => ({ workout, exercises: exercises.get(workout.id)?.size ?? 0 }))
}
