import { plannedWeight, readTemplate, setKind, type SetKind } from './methods'
import { DEFAULT_FICHE, type ProgramDayExercise, type UserExercise, type WorkoutSet } from './types'

/**
 * Séries d'une nouvelle séance selon la méthode de chaque exercice (celle du jour, sinon celle de la fiche).
 * `fiches` et `lastSets` sont indexés par exercise_id ; `lastSets` = séries de la dernière séance terminée,
 * utilisées en mode manuel pour reprendre les charges réellement soulevées : la i-ème série d'un type
 * reprend la i-ème série du même type (un échauffement ajouté ne décale donc pas les séries de travail).
 */
export function buildWorkoutSets(
  workoutId: string,
  dayExercises: ProgramDayExercise[],
  fiches: Map<string, UserExercise>,
  lastSets: Map<string, WorkoutSet[]> = new Map(),
): WorkoutSet[] {
  const sets: WorkoutSet[] = []
  for (const de of [...dayExercises].sort((a, b) => a.position - b.position)) {
    const f = fiches.get(de.exercise_id) ?? { ...DEFAULT_FICHE }
    const template = readTemplate(de.template ?? ('template' in f ? f.template : null), f)
    const manual = 'auto_progression' in f && f.auto_progression === false
    const previousByKind = new Map<SetKind, WorkoutSet[]>()
    for (const prev of [...(lastSets.get(de.exercise_id) ?? [])].sort((a, b) => a.position - b.position)) {
      previousByKind.set(setKind(prev), [...(previousByKind.get(setKind(prev)) ?? []), prev])
    }
    const seen = new Map<SetKind, number>()
    const rounding = 'rounding' in f ? f.rounding : undefined
    template.sets.forEach((p) => {
      const rank = seen.get(p.kind) ?? 0
      seen.set(p.kind, rank + 1)
      const previous = previousByKind.get(p.kind)?.[rank]
      const weight = manual && previous ? previous.weight : plannedWeight(f.current_weight, p.pct, rounding)
      // Échec et AMRAP : rien de pré-rempli, on saisit ce qu'on a fait.
      const reps = p.reps === null || p.kind === 'amrap' ? 0 : p.reps
      sets.push({
        id: crypto.randomUUID(),
        workout_id: workoutId,
        exercise_id: de.exercise_id,
        position: sets.length,
        kind: p.kind,
        target_reps: p.reps,
        ...(p.repsMax !== undefined ? { target_reps_max: p.repsMax } : {}),
        reps,
        weight,
        done: false,
      })
    })
  }
  return sets
}
