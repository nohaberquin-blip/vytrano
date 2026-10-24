import { ageOn, bmi, bmiCategory, computeNeeds, rollingAverage } from './needs'
import type { BodyProfile, WeightEntry } from './types'

const TODAY = '2026-10-25'
const profile = (p: Partial<BodyProfile> = {}): BodyProfile => ({
  id: 'u', user_id: 'u', sex: 'male', birth_date: '1996-10-25', height_cm: 180, activity: 'sedentary',
  sessions_per_week: 4, goal: 'cut', kcal_override: null, protein_per_kg: null, fat_pct: null, ...p,
})

test('homme : métabolisme, maintien, calories, macros, IMC', () => {
  const n = computeNeeds(profile(), 75, TODAY)
  expect(n).toMatchObject({ bmr: 1730, maintenance: 2422, kcal: 1940, protein: 165, fat: 54, carbs: 199, bmi: 23.1, carbsExhausted: false, missing: [] })
  expect(n.custom).toEqual({ kcal: false, protein: false, fat: false })
})

test('femme peu active, maintien', () => {
  const n = computeNeeds(profile({ sex: 'female', birth_date: '2001-10-25', height_cm: 165, activity: 'light', sessions_per_week: 3, goal: 'maintain' }), 60, TODAY)
  expect(n).toMatchObject({ bmr: 1345, kcal: 1950, protein: 96, fat: 54, carbs: 270 })
})

test('sexe non précisé : moyenne des deux formules', () => {
  expect(computeNeeds(profile({ sex: 'unspecified' }), 75, TODAY).bmr).toBe(1647)
})

test('chaque objectif applique son facteur et ses protéines', () => {
  const at = (goal: BodyProfile['goal']) => computeNeeds(profile({ goal }), 75, TODAY)
  expect(at('bulk')).toMatchObject({ kcal: 2660, protein: 135 })
  expect(at('maintain')).toMatchObject({ kcal: 2420, protein: 120 })
  expect(at('recomp')).toMatchObject({ kcal: 2300, protein: 150 })
  expect(at('strength')).toMatchObject({ kcal: 2540, protein: 135 })
})

test('IMC > 30 : grammes calculés sur le poids d’un IMC de 25', () => {
  const n = computeNeeds(profile(), 110, TODAY)
  expect(n.bmi).toBe(34)
  expect(bmiCategory(n.bmi!)).toBe('Obésité')
  expect(n.protein).toBe(178)
})

test('lipides : minimum de 0,6 g/kg', () => {
  expect(computeNeeds(profile({ fat_pct: 15, kcal_override: 1200 }), 75, TODAY).fat).toBe(45)
})

test('glucides épuisés', () => {
  const n = computeNeeds(profile({ kcal_override: 1200, protein_per_kg: 3 }), 75, TODAY)
  expect(n.carbs).toBe(0)
  expect(n.carbsExhausted).toBe(true)
})

test('réglages perso : le total reste égal aux calories, les glucides absorbent', () => {
  const a = computeNeeds(profile({ kcal_override: 2500 }), 75, TODAY)
  expect(a).toMatchObject({ kcal: 2500, protein: 165, fat: 69, carbs: 305 })
  expect(a.custom).toEqual({ kcal: true, protein: false, fat: false })
  const b = computeNeeds(profile({ kcal_override: 2500, fat_pct: 30 }), 75, TODAY)
  expect(b.fat).toBe(83)
  expect(b.carbs).toBe(273)
  expect(b.custom.fat).toBe(true)
})

test('infos manquantes : seuls les blocs calculables sont remplis', () => {
  const none = computeNeeds(null, null, TODAY)
  expect(none).toMatchObject({ bmi: null, bmr: null, kcal: null, protein: null })
  expect(none.missing).toContain('ta pesée')
  const partial = computeNeeds(profile({ sex: null, birth_date: null, activity: null, goal: null }), 75, TODAY)
  expect(partial).toMatchObject({ bmi: 23.1, bmr: null, kcal: null })
  expect(partial.missing).toEqual(['ta date de naissance', 'ton sexe', 'ton activité', 'ton objectif'])
  const manual = computeNeeds(profile({ sex: null, goal: null, kcal_override: 2000 }), 75, TODAY)
  expect(manual).toMatchObject({ kcal: 2000, protein: 120 })
})

test('âge : la veille et le jour de l’anniversaire', () => {
  expect(ageOn('1996-10-25', '2026-10-24')).toBe(29)
  expect(ageOn('1996-10-25', '2026-10-25')).toBe(30)
  expect(bmi(75, 180)).toBe(23.1)
})

test('moyenne glissante sur 7 jours', () => {
  const e = (date: string, weight_kg: number): WeightEntry => ({ id: date, user_id: 'u', date, weight_kg })
  expect(rollingAverage([e('2026-10-10', 78), e('2026-10-01', 80), e('2026-10-02', 79)])).toEqual([
    { date: '2026-10-01', avg: 80 }, { date: '2026-10-02', avg: 79.5 }, { date: '2026-10-10', avg: 78 },
  ])
})
