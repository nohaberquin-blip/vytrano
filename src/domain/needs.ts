import { addDays } from './calendar'
import type { Activity, BodyProfile, Goal, Sex, WeightEntry } from './types'

export const SEX_LABELS: Record<Sex, string> = { male: 'Homme', female: 'Femme', unspecified: 'Ne pas préciser' }

export const ACTIVITY_FACTORS: Record<Activity, number> = { sedentary: 1.2, light: 1.3, active: 1.4, very_active: 1.5 }
export const ACTIVITY_LABELS: Record<Activity, { label: string; hint: string }> = {
  sedentary: { label: 'Sédentaire', hint: 'Bureau, peu de marche' },
  light: { label: 'Peu actif', hint: 'Un peu de marche, debout parfois' },
  active: { label: 'Actif', hint: 'Travail debout, beaucoup de marche' },
  very_active: { label: 'Très actif', hint: 'Travail physique' },
}

export const GOALS: Record<Goal, { label: string; kcal: number; proteinPerKg: number }> = {
  bulk: { label: 'Prise de masse', kcal: 1.1, proteinPerKg: 1.8 },
  cut: { label: 'Sèche', kcal: 0.8, proteinPerKg: 2.2 },
  maintain: { label: 'Maintien', kcal: 1, proteinPerKg: 1.6 },
  recomp: { label: 'Recomposition', kcal: 0.95, proteinPerKg: 2 },
  strength: { label: 'Force / performance', kcal: 1.05, proteinPerKg: 1.8 },
}

const SEX_OFFSET: Record<Sex, number> = { male: 5, female: -161, unspecified: -78 }
export const DEFAULT_FAT_PCT = 25
/** Protéines quand aucun objectif n'est choisi (calories réglées à la main). */
const FALLBACK_PROTEIN = 1.6

/** Années révolues au jour `today`. */
export function ageOn(birth: string, today: string): number {
  const [by, bm, bd] = birth.split('-').map(Number)
  const [ty, tm, td] = today.split('-').map(Number)
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0)
}

export const bmi = (weightKg: number, heightCm: number) => Math.round((weightKg / (heightCm / 100) ** 2) * 10) / 10

export function bmiCategory(b: number): 'Maigreur' | 'Normal' | 'Surpoids' | 'Obésité' {
  return b < 18.5 ? 'Maigreur' : b < 25 ? 'Normal' : b < 30 ? 'Surpoids' : 'Obésité'
}

export interface Needs {
  missing: string[]
  bmi: number | null
  bmr: number | null
  maintenance: number | null
  kcal: number | null
  protein: number | null
  fat: number | null
  carbs: number | null
  carbsExhausted: boolean
  custom: { kcal: boolean; protein: boolean; fat: boolean }
}

/** Besoins du jour à partir de la fiche et de la dernière pesée ; null pour ce qui n'est pas calculable. */
export function computeNeeds(p: BodyProfile | null, weightKg: number | null, today: string): Needs {
  const height = p?.height_cm ?? null
  const age = p?.birth_date ? ageOn(p.birth_date, today) : null
  const missing = [
    weightKg === null && 'ta pesée',
    height === null && 'ta taille',
    age === null && 'ta date de naissance',
    !p?.sex && 'ton sexe',
    !p?.activity && 'ton activité',
    p?.sessions_per_week == null && 'tes séances par semaine',
    !p?.goal && 'ton objectif',
  ].filter((m): m is string => !!m)

  const b = weightKg !== null && height !== null ? bmi(weightKg, height) : null
  const rawBmr = weightKg !== null && height !== null && age !== null && p?.sex
    ? 10 * weightKg + 6.25 * height - 5 * age + SEX_OFFSET[p.sex] : null
  const rawMaintenance = rawBmr !== null && p?.activity && p.sessions_per_week != null
    ? rawBmr * (ACTIVITY_FACTORS[p.activity] + 0.05 * p.sessions_per_week) : null
  const auto = rawMaintenance !== null && p?.goal ? Math.round((rawMaintenance * GOALS[p.goal].kcal) / 10) * 10 : null
  const kcal = p?.kcal_override ?? auto

  const custom = { kcal: p?.kcal_override != null, protein: p?.protein_per_kg != null, fat: p?.fat_pct != null }
  const out: Needs = {
    missing, bmi: b, bmr: rawBmr === null ? null : Math.round(rawBmr),
    maintenance: rawMaintenance === null ? null : Math.round(rawMaintenance),
    kcal, protein: null, fat: null, carbs: null, carbsExhausted: false, custom,
  }
  if (kcal === null || weightKg === null) return out

  // Au-delà d'un IMC de 30, les grammes se calculent sur le poids d'un IMC de 25.
  const ref = b !== null && b > 30 ? 25 * (height! / 100) ** 2 : weightKg
  const perKg = p?.protein_per_kg ?? (p?.goal ? GOALS[p.goal].proteinPerKg : FALLBACK_PROTEIN)
  const protein = Math.round(perKg * ref)
  const fat = Math.round(Math.max((((p?.fat_pct ?? DEFAULT_FAT_PCT) / 100) * kcal) / 9, 0.6 * ref))
  const rest = (kcal - 4 * protein - 9 * fat) / 4
  return { ...out, protein, fat, carbs: Math.max(0, Math.round(rest)), carbsExhausted: rest < 0 }
}

/** Moyenne des pesées des 7 derniers jours (jour compris), pour chaque pesée, par date croissante. */
export function rollingAverage(entries: WeightEntry[]): { date: string; avg: number }[] {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
  return sorted.map((e) => {
    const from = addDays(e.date, -6)
    const window = sorted.filter((x) => x.date >= from && x.date <= e.date)
    return { date: e.date, avg: Math.round((window.reduce((s, x) => s + x.weight_kg, 0) / window.length) * 100) / 100 }
  })
}
