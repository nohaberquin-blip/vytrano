import { workoutDate } from './calendar'
import { COUNTING_KINDS, setKind } from './methods'
import type { Workout, WorkoutSet } from './types'

export type RecordKind = 'weight' | 'e1rm'
export interface Best { value: number; date: string }
/** Une séance : meilleures valeurs, et `record` si elle a battu au moins un record. */
export interface Point { date: string; weight: number; e1rm: number; record: boolean }
/** Séries d'un exercice dans une séance (les séances sont données dans l'ordre chronologique). */
export interface SessionSets { workout: Workout; sets: WorkoutSet[] }

const half = (n: number) => Math.round(n * 2) / 2

/** 1RM estimé (Epley), arrondi à 0,5 kg ; une série à 1 répétition vaut sa charge. */
export function oneRepMax(s: Pick<WorkoutSet, 'weight' | 'reps'>): number {
  return s.reps === 1 ? s.weight : half(s.weight * (1 + s.reps / 30))
}

/** Série prise en compte : validée, qui compte (ni échauffement ni rattachée), avec charge et répétitions. */
export const counts = (s: WorkoutSet) => s.done && COUNTING_KINDS.includes(setKind(s)) && s.weight > 0 && s.reps > 0

const byPosition = (a: WorkoutSet, b: WorkoutSet) => a.position - b.position

/** Records battus série par série, en partant des meilleures valeurs `best` (null = rien à battre). */
function walk(best: { weight: number; e1rm: number } | null, sets: WorkoutSet[]) {
  const records = new Map<string, RecordKind[]>()
  let current = best && { ...best }
  for (const s of [...sets].sort(byPosition).filter(counts)) {
    const e1rm = oneRepMax(s)
    if (current) {
      const kinds: RecordKind[] = []
      if (s.weight > current.weight) kinds.push('weight')
      if (e1rm > current.e1rm) kinds.push('e1rm')
      if (kinds.length) records.set(s.id, kinds)
    }
    // La première séance ne bat rien, mais fixe la référence pour les suivantes.
    current = current
      ? { weight: Math.max(current.weight, s.weight), e1rm: Math.max(current.e1rm, e1rm) }
      : null
  }
  return { records, current }
}

/** Meilleures valeurs des séances données (null si aucune série prise en compte). */
function bestOf(history: SessionSets[]): { weight: number; e1rm: number } | null {
  const sets = history.flatMap((h) => h.sets).filter(counts)
  if (sets.length === 0) return null
  return { weight: Math.max(...sets.map((s) => s.weight)), e1rm: Math.max(...sets.map(oneRepMax)) }
}

/** Records de la séance en cours, série par série, comparés aux séances précédentes. */
export function setRecords(previous: SessionSets[], current: WorkoutSet[]): Map<string, RecordKind[]> {
  return walk(bestOf(previous), current).records
}

/** Records d'un exercice : meilleures valeurs (avec leur date), un point par séance, date du dernier record. */
export function exerciseRecords(history: SessionSets[]): {
  weight: Best | null; e1rm: Best | null; points: Point[]; lastRecord: string | null
} {
  let best: { weight: number; e1rm: number } | null = null
  let weight: Best | null = null
  let e1rm: Best | null = null
  let lastRecord: string | null = null
  const points: Point[] = []
  for (const { workout, sets } of history) {
    const done = sets.filter(counts)
    if (done.length === 0) continue
    const date = workoutDate(workout)
    const { records } = walk(best, sets)
    const top = { weight: Math.max(...done.map((s) => s.weight)), e1rm: Math.max(...done.map(oneRepMax)) }
    if (!weight || top.weight > weight.value) weight = { value: top.weight, date }
    if (!e1rm || top.e1rm > e1rm.value) e1rm = { value: top.e1rm, date }
    const record = records.size > 0
    if (record) lastRecord = date
    points.push({ date, weight: top.weight, e1rm: top.e1rm, record })
    best = { weight: weight.value, e1rm: e1rm.value }
  }
  return { weight, e1rm, points, lastRecord }
}
