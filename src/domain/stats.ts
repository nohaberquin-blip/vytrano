import { setKind } from './methods'
import type { Unit, Workout, WorkoutSet } from './types'

export interface GlobalStats { sessions: number; minutes: number; tonnageKg: number }

/** Chiffres depuis le début, sur les séances terminées (allégées comprises) ; échauffements hors charge totale. */
export function globalStats(workouts: Workout[], sets: WorkoutSet[]): GlobalStats {
  const ids = new Set(workouts.map((w) => w.id))
  let ms = 0
  for (const w of workouts) if (w.finished_at) ms += Math.max(0, new Date(w.finished_at).getTime() - new Date(w.started_at).getTime())
  let tonnageKg = 0
  for (const s of sets) {
    if (ids.has(s.workout_id) && s.done && setKind(s) !== 'warmup' && s.weight > 0 && s.reps > 0) tonnageKg += s.weight * s.reps
  }
  return { sessions: workouts.length, minutes: Math.round(ms / 60_000), tonnageKg }
}

/** « 45 min » sous une heure, sinon heures entières : « 64 h ». */
export const formatDuration = (minutes: number) => (minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h`)

/** « 850 kg », « 182,5 t » ; en livres : « 27 300 lb ». */
export function formatTonnage(kg: number, unit: Unit): string {
  const fmt = (n: number, digits = 0) => n.toLocaleString('fr-FR', { maximumFractionDigits: digits })
  if (unit === 'lb') return `${fmt(Math.round(kg * 2.20462))} lb`
  return kg < 1000 ? `${fmt(Math.round(kg))} kg` : `${fmt(kg / 1000, 1)} t`
}
