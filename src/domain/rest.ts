import { setKind } from './methods'
import type { UserExercise, WorkoutSet } from './types'

/** Repos avant une série rattachée : on enchaîne presque sans pause. */
export const ATTACHED_REST = { drop: 15, restpause: 20, cluster: 20 } as const
const WARMUP_REST = 60
const MIN_REST = 15
const MAX_REST = 600

/** Repos de base selon les reps visées ; null (jusqu'à l'échec) = 2 min. */
export function baseRest(targetReps: number | null): number {
  if (targetReps === null) return 120
  return targetReps <= 5 ? 180 : targetReps <= 12 ? 120 : 75
}

/**
 * Repos après la série `set` qui vient d'être validée, avant `next` (null s'il n'y a plus rien à faire).
 * Ajusté selon le type de série, la difficulté réelle (reps faites) et la charge par rapport à la référence.
 */
export function restSeconds(
  set: WorkoutSet,
  next: WorkoutSet | undefined,
  fiche: Pick<UserExercise, 'rest_seconds' | 'target_reps' | 'current_weight'> | undefined,
): number | null {
  if (!next) return null
  const nextKind = setKind(next)
  if (nextKind in ATTACHED_REST) return ATTACHED_REST[nextKind as keyof typeof ATTACHED_REST]
  const kind = setKind(set)
  if (kind === 'warmup') return WARMUP_REST

  let rest = fiche?.rest_seconds ?? baseRest(set.target_reps)
  if (kind === 'top' || kind === 'amrap') rest += 30
  if (set.target_reps !== null) {
    if (set.reps < set.target_reps) rest += 30
    else if (set.reps >= (set.target_reps_max ?? set.target_reps) + 2) rest -= 15
  }
  const reference = fiche?.current_weight ?? 0
  if (reference > 0 && set.weight >= 0.9 * reference) rest += 15
  return Math.min(MAX_REST, Math.max(MIN_REST, rest))
}

/** 150 → « 2:30 ». */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** « 2:30 » ou « 150 » → 150 ; '' → null ; saisie invalide → NaN. */
export function parseClock(text: string): number | null {
  const t = text.trim()
  if (t === '') return null
  const m = /^(\d{1,2}):(\d{2})$/.exec(t)
  if (m) return Number(m[2]) < 60 ? Number(m[1]) * 60 + Number(m[2]) : NaN
  return /^\d{1,3}$/.test(t) ? Number(t) : NaN
}
