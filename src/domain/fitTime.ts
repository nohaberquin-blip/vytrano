import { ATTACHED_KINDS, setKind } from './methods'
import { restSeconds } from './rest'
import type { UserExercise, WorkoutSet } from './types'

export const TIME_CHOICES = [90, 60, 45, 30, 20] as const
/** Bornes du temps libre (minutes). */
export const TIME_MIN = 10
export const TIME_MAX = 180

/** Un exercice du jour (dans l'ordre) avec ses séries prévues. `key` = ligne du jour (un exercice peut y être deux fois). */
export interface FitExercise { key: string; exerciseId: string; priority: boolean; sets: WorkoutSet[] }
type Fiches = Map<string, Pick<UserExercise, 'rest_seconds' | 'target_reps' | 'current_weight'>>

const SETUP_SECONDS = 60
const SECONDS_PER_REP = 4
const MIN_SET_SECONDS = 30
/** Reps supposées quand il n'y a pas de cible (échec, AMRAP). */
const DEFAULT_REPS = 10
/** Séries de travail gardées au minimum quand on réduit un exercice. */
const MIN_UNITS = 2

/** Durée estimée : installation par exercice, temps de chaque série, repos du minuteur entre les séries. */
export function estimateSeconds(exercises: FitExercise[], fiches: Fiches): number {
  const all = exercises.flatMap((e) => e.sets)
  let total = exercises.filter((e) => e.sets.length > 0).length * SETUP_SECONDS
  all.forEach((set, i) => {
    const reps = set.target_reps ?? DEFAULT_REPS
    total += Math.max(MIN_SET_SECONDS, reps * SECONDS_PER_REP)
    // Repos calculé comme si la série était faite comme prévu.
    total += restSeconds({ ...set, reps, done: true }, all[i + 1], fiches.get(set.exercise_id)) ?? 0
  })
  return total
}

/** Séries principales suivies de leurs séries rattachées (drop, reprise, cluster) ; les échauffements à part. */
function units(sets: WorkoutSet[]): { warmups: WorkoutSet[]; units: WorkoutSet[][] } {
  const warmups: WorkoutSet[] = []
  const out: WorkoutSet[][] = []
  for (const s of sets) {
    const kind = setKind(s)
    if (kind === 'warmup') warmups.push(s)
    else if (ATTACHED_KINDS.includes(kind) && out.length > 0) out[out.length - 1].push(s)
    else out.push([s])
  }
  return { warmups, units: out }
}

/** Garde `max` unités, en retirant d'abord celles de la fin, les top-sets en dernier. */
function keepUnits(sets: WorkoutSet[], max: number): WorkoutSet[] {
  const { warmups, units: list } = units(sets)
  const kept = [...list]
  while (kept.length > max) {
    let i = kept.length - 1
    while (i >= 0 && setKind(kept[i][0]) === 'top') i--
    kept.splice(i >= 0 ? i : kept.length - 1, 1)
  }
  return [...warmups, ...kept.flat()]
}

export interface FitResult {
  exercises: FitExercise[]
  /** Par exercice modifié : nombre de séries avant et après (0 = retiré). */
  changes: { key: string; from: number; to: number }[]
  fullSeconds: number
  seconds: number
  /** Même au plus court, la séance dépasse la limite. */
  minimum: boolean
  changed: boolean
}

export const fitToTime = (exercises: FitExercise[], fiches: Fiches, minutes: number) => fitToSeconds(exercises, fiches, minutes * 60)

/**
 * Raccourcit la séance par étapes jusqu'à tenir dans `limit` secondes (spec §4). Ne touche jamais aux charges,
 * aux reps ni aux repos : seules des séries ou des exercices entiers sont retirés.
 */
export function fitToSeconds(exercises: FitExercise[], fiches: Fiches, limit: number): FitResult {
  let current = exercises.map((e) => ({ ...e, sets: [...e.sets] }))
  const fullSeconds = estimateSeconds(current, fiches)
  const fits = () => estimateSeconds(current, fiches) <= limit
  const replace = (key: string, sets: WorkoutSet[]) => { current = current.map((e) => (e.key === key ? { ...e, sets } : e)) }

  const steps: (() => boolean)[] = [
    // 1. Un seul échauffement (le dernier) par exercice, sauf le premier.
    () => {
      current.slice(1).forEach((e) => {
        const w = e.sets.filter((s) => setKind(s) === 'warmup')
        if (w.length > 1) replace(e.key, e.sets.filter((s) => setKind(s) !== 'warmup' || s === w[w.length - 1]))
      })
      return fits()
    },
    // 2. Non prioritaires à 2 unités, de la fin vers le début.
    () => {
      for (const e of [...current].reverse().filter((x) => !x.priority)) {
        replace(e.key, keepUnits(e.sets, MIN_UNITS))
        if (fits()) return true
      }
      return false
    },
    // 3. Non prioritaires retirés, de la fin vers le début ; il reste toujours un exercice.
    () => {
      const hasPriority = current.some((e) => e.priority)
      for (const e of [...current].reverse().filter((x) => !x.priority)) {
        if (!hasPriority && e.key === current[0].key) break
        if (current.length <= 1) break
        current = current.filter((x) => x.key !== e.key)
        if (fits()) return true
      }
      return false
    },
    // 4. Prioritaires à 2 unités, de la fin vers le début.
    () => {
      for (const e of [...current].reverse().filter((x) => x.priority)) {
        replace(e.key, keepUnits(e.sets, MIN_UNITS))
        if (fits()) return true
      }
      return false
    },
  ]

  let ok = fits()
  for (const step of steps) {
    if (ok) break
    ok = step()
  }

  // Positions renumérotées dans l'ordre de la séance.
  let position = 0
  current = current.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s, position: position++ })) }))
  const changes = exercises
    .map((e) => ({ key: e.key, from: e.sets.length, to: current.find((c) => c.key === e.key)?.sets.length ?? 0 }))
    .filter((c) => c.from !== c.to)
  return { exercises: current, changes, fullSeconds, seconds: estimateSeconds(current, fiches), minimum: !ok, changed: changes.length > 0 }
}
