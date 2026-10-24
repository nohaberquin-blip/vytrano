import { DEFAULT_FICHE, type ProgramDayExercise, type UserExercise, type WorkoutSet } from './types'

/** Séries d'une nouvelle séance, pré-remplies avec la cible de chaque fiche. `fiches` est indexé par exercise_id. */
export function buildWorkoutSets(
  workoutId: string,
  dayExercises: ProgramDayExercise[],
  fiches: Map<string, UserExercise>,
): WorkoutSet[] {
  const sets: WorkoutSet[] = []
  for (const de of [...dayExercises].sort((a, b) => a.position - b.position)) {
    const f = fiches.get(de.exercise_id) ?? DEFAULT_FICHE
    for (let i = 0; i < f.sets; i++) {
      sets.push({
        id: crypto.randomUUID(),
        workout_id: workoutId,
        exercise_id: de.exercise_id,
        position: sets.length,
        target_reps: f.target_reps,
        reps: f.target_reps,
        weight: f.current_weight,
        done: false,
      })
    }
  }
  return sets
}
