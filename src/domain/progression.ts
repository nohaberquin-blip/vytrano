import type { UserExercise, WorkoutSet } from './types'

export const round2 = (n: number) => Math.round(n * 100) / 100

/** Charge proposée pour la prochaine séance, d'après les séries de la dernière. */
export function nextWeight(fiche: UserExercise, lastSets: WorkoutSet[]): number {
  if (lastSets.length === 0) return fiche.current_weight
  const success = lastSets.every((s) => s.done && s.reps >= s.target_reps)
  return success ? round2(fiche.current_weight + fiche.increment) : fiche.current_weight
}
