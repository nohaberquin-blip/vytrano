import { COUNTING_KINDS, setKind } from './methods'
import type { UserExercise, WorkoutSet } from './types'

export const round2 = (n: number) => Math.round(n * 100) / 100

/** Une série qui compte est réussie si elle est validée et atteint sa cible (le haut de la fourchette s'il y en a une). */
function succeeded(s: WorkoutSet): boolean {
  if (!s.done) return false
  const target = s.target_reps_max ?? s.target_reps
  return target === null || s.reps >= target
}

/** Charge de référence pour la prochaine séance, d'après les séries de la dernière. */
export function nextWeight(fiche: UserExercise, lastSets: WorkoutSet[]): number {
  if (fiche.auto_progression === false) return fiche.current_weight
  const counting = lastSets.filter((s) => COUNTING_KINDS.includes(setKind(s)))
  if (counting.length === 0) return fiche.current_weight
  return counting.every(succeeded) ? round2(fiche.current_weight + fiche.increment) : fiche.current_weight
}
