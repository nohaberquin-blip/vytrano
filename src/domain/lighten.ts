import { keepUnits, type FitExercise } from './fitTime'
import { COUNTING_KINDS, DEFAULT_ROUNDING, roundTo, setKind } from './methods'
import type { Lightening, UserExercise } from './types'

const FACTOR: Record<'minus10' | 'minus20', number> = { minus10: 0.9, minus20: 0.8 }

/** Séance allégée : charges réduites (arrondies au pas de l'exercice) ou 2 unités par exercice. */
export function lighten(exercises: FitExercise[], mode: Lightening, fiches: Map<string, Pick<UserExercise, 'rounding'>>): FitExercise[] {
  if (mode === 'fewer') return exercises.map((e) => ({ ...e, sets: keepUnits(e.sets, 2) }))
  return exercises.map((e) => ({
    ...e,
    sets: e.sets.map((s) => ({ ...s, weight: lighter(s.weight, FACTOR[mode], fiches.get(e.exerciseId)?.rounding) })),
  }))
}

/** Charge réduite et arrondie au pas, mais toujours au moins un pas plus bas (sinon l'arrondi annulerait l'allègement). */
function lighter(weight: number, factor: number, rounding: number | undefined): number {
  if (weight <= 0) return weight
  const reduced = roundTo(weight * factor, rounding)
  return reduced < weight ? reduced : Math.max(0, roundTo(weight - (rounding && rounding > 0 ? rounding : DEFAULT_ROUNDING), rounding))
}

export interface LightenChange { key: string; fromKg: number; toKg: number; from: number; to: number }

const workKg = (e: FitExercise) => (e.sets.find((s) => COUNTING_KINDS.includes(setKind(s))) ?? e.sets[0])?.weight ?? 0

/** Exercices modifiés par l'allègement : charge de la 1re série qui compte et nombre de séries. */
export function lightenChanges(before: FitExercise[], after: FitExercise[]): LightenChange[] {
  return before.flatMap((b) => {
    const a = after.find((x) => x.key === b.key)
    const change = { key: b.key, fromKg: workKg(b), toKg: a ? workKg(a) : 0, from: b.sets.length, to: a?.sets.length ?? 0 }
    return change.fromKg !== change.toKg || change.from !== change.to ? [change] : []
  })
}
