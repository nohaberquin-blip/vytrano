import type { WorkoutSet } from './types'

export type SetKind = 'warmup' | 'work' | 'top' | 'backoff' | 'drop' | 'restpause' | 'cluster' | 'amrap'

export interface PlannedSet {
  kind: SetKind
  /** Répétitions visées ; null = jusqu'à l'échec. */
  reps: number | null
  /** Haut de fourchette (double progression, myo-reps). */
  repsMax?: number
  /** Pourcentage de la charge de référence. */
  pct: number
}

export type MethodId =
  | 'classic' | 'top_backoff' | 'ramp' | 'pyramid_down' | 'pyramid_full' | 'dropset'
  | 'rest_pause' | 'myo_reps' | 'cluster' | 'amrap' | 'double_progression' | 'custom'

export interface SetTemplate {
  method: MethodId
  sets: PlannedSet[]
}

export type PresetId = Exclude<MethodId, 'custom'>

export const METHOD_LABELS: Record<MethodId, string> = {
  classic: 'Classique',
  top_backoff: 'Top set + back-off',
  ramp: 'Montée en charge',
  pyramid_down: 'Pyramide descendante',
  pyramid_full: 'Pyramide complète',
  dropset: 'Dropset',
  rest_pause: 'Rest-pause',
  myo_reps: 'Myo-reps',
  cluster: 'Cluster sets',
  amrap: 'AMRAP',
  double_progression: 'Double progression',
  custom: 'Personnalisée',
}

export const KIND_LABELS: Record<SetKind, string> = {
  warmup: 'ÉCHAUF.',
  work: 'TRAVAIL',
  top: 'TOP-SET',
  backoff: 'BACK-OFF',
  drop: 'DROP',
  restpause: 'REPRISE',
  cluster: 'CLUSTER',
  amrap: 'AMRAP',
}

export const SET_KINDS = Object.keys(KIND_LABELS) as SetKind[]
/** Séries prises en compte pour la progression. */
export const COUNTING_KINDS: SetKind[] = ['work', 'top', 'backoff', 'cluster', 'amrap']
/** Séries affichées en retrait sous la précédente. */
export const ATTACHED_KINDS: SetKind[] = ['drop', 'restpause', 'cluster']

const s = (kind: SetKind, reps: number | null, pct: number, repsMax?: number): PlannedSet =>
  repsMax === undefined ? { kind, reps, pct } : { kind, reps, repsMax, pct }
const times = (n: number, set: PlannedSet) => Array.from({ length: n }, () => ({ ...set }))

const PRESETS: Record<PresetId, () => PlannedSet[]> = {
  classic: () => times(4, s('work', 8, 100)),
  top_backoff: () => [s('top', 5, 100), ...times(3, s('backoff', 8, 85))],
  ramp: () => [s('work', 10, 70), s('work', 8, 80), s('work', 6, 90), s('work', 4, 100)],
  pyramid_down: () => [s('work', 4, 100), s('work', 6, 90), s('work', 8, 80), s('work', 10, 70)],
  pyramid_full: () => [s('work', 10, 70), s('work', 6, 90), s('work', 4, 100), s('work', 6, 90), s('work', 10, 70)],
  dropset: () => [...times(3, s('work', 8, 100)), s('drop', null, 80), s('drop', null, 60)],
  rest_pause: () => [s('work', null, 100), ...times(2, s('restpause', null, 100))],
  myo_reps: () => [s('work', 12, 100, 15), ...times(4, s('restpause', 3, 100, 5))],
  cluster: () => times(12, s('cluster', 3, 100)),
  amrap: () => [...times(3, s('work', 5, 100)), s('amrap', 5, 100)],
  double_progression: () => times(3, s('work', 8, 100, 12)),
}

export const PRESET_IDS = Object.keys(PRESETS) as PresetId[]

export function presetTemplate(method: PresetId): SetTemplate {
  return { method, sets: PRESETS[method]() }
}

const WARMUP: PlannedSet[] = [s('warmup', 8, 50), s('warmup', 5, 70)]

export const hasWarmup = (t: SetTemplate) => t.sets.some((x) => x.kind === 'warmup')

export function withoutWarmup(t: SetTemplate): SetTemplate {
  return { ...t, sets: t.sets.filter((x) => x.kind !== 'warmup') }
}

export function withWarmup(t: SetTemplate): SetTemplate {
  return hasWarmup(t) ? t : { ...t, sets: [...WARMUP.map((w) => ({ ...w })), ...t.sets] }
}

export function classicFrom(f: { sets: number; target_reps: number }): SetTemplate {
  return { method: 'classic', sets: times(f.sets, s('work', f.target_reps, 100)) }
}

const isPlannedSet = (x: unknown): x is PlannedSet => {
  if (!x || typeof x !== 'object') return false
  const p = x as Record<string, unknown>
  return SET_KINDS.includes(p.kind as SetKind)
    && (p.reps === null || typeof p.reps === 'number')
    && (p.repsMax === undefined || typeof p.repsMax === 'number')
    && typeof p.pct === 'number'
}

/** Modèle enregistré, ou classique depuis la fiche s'il est absent ou illisible. */
export function readTemplate(raw: unknown, fiche: { sets: number; target_reps: number }): SetTemplate {
  const t = raw as Partial<SetTemplate> | null | undefined
  if (t && typeof t === 'object' && t.method && t.method in METHOD_LABELS
    && Array.isArray(t.sets) && t.sets.length > 0 && t.sets.every(isPlannedSet)) {
    return t as SetTemplate
  }
  return classicFrom(fiche)
}

export function templateError(t: SetTemplate): string | null {
  if (!t.sets.some((x) => COUNTING_KINDS.includes(x.kind))) return 'Au moins une série qui compte'
  for (const x of t.sets) {
    if (!(x.pct >= 1 && x.pct <= 200)) return 'Pourcentage entre 1 et 200'
    if (x.reps !== null && !(x.reps >= 1 && x.reps <= 100)) return 'Répétitions entre 1 et 100'
    if (x.repsMax !== undefined && (x.reps === null || x.repsMax < x.reps || x.repsMax > 100)) return 'Fourchette invalide'
  }
  return null
}

const DEFAULT_ROUNDING = 2.5

/** Multiple de `step` le plus proche (2,5 kg si le pas est absent ou invalide). */
export function roundTo(value: number, step: number | undefined): number {
  const st = step && step > 0 ? step : DEFAULT_ROUNDING
  return Math.round(Math.round(value / st) * st * 100) / 100
}

/** Charge d'une série : la référence telle quelle à 100 %, sinon le pourcentage arrondi. */
export function plannedWeight(reference: number, pct: number, rounding?: number): number {
  if (pct === 100) return reference
  return roundTo((reference * pct) / 100, rounding)
}

export const setKind = (x: WorkoutSet): SetKind => x.kind ?? 'work'
