import { nextWeight } from './progression'
import type { UserExercise, WorkoutSet } from './types'

const fiche: UserExercise = { id: 'f', user_id: 'u', exercise_id: 'e', current_weight: 60, sets: 4, target_reps: 8, increment: 2.5 }
const sets = (reps: number[], done = true): WorkoutSet[] =>
  reps.map((r, i) => ({ id: `s${i}`, workout_id: 'w', exercise_id: 'e', position: i, target_reps: 8, reps: r, weight: 60, done }))

test('toutes les séries réussies → +palier', () => {
  expect(nextWeight(fiche, sets([8, 8, 8, 8]))).toBe(62.5)
})
test('une série sous la cible → charge inchangée', () => {
  expect(nextWeight(fiche, sets([8, 8, 7, 8]))).toBe(60)
})
test('une série non validée → charge inchangée', () => {
  const s = sets([8, 8, 8, 8]); s[2].done = false
  expect(nextWeight(fiche, s)).toBe(60)
})
test('plus de reps que la cible compte comme réussi', () => {
  expect(nextWeight(fiche, sets([10, 9, 8, 8]))).toBe(62.5)
})
test('aucune séance précédente → charge actuelle', () => {
  expect(nextWeight(fiche, [])).toBe(60)
})
test('arrondi au centième', () => {
  expect(nextWeight({ ...fiche, current_weight: 0.1, increment: 0.2 }, sets([8]))).toBe(0.3)
})
