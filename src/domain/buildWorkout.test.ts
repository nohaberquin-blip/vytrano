import { buildWorkoutSets } from './buildWorkout'
import type { ProgramDayExercise, UserExercise } from './types'

const de = (exercise_id: string, position: number): ProgramDayExercise => ({ id: `de${position}`, day_id: 'd', exercise_id, position })
const fiche = (exercise_id: string, sets: number, target_reps: number, current_weight: number): UserExercise =>
  ({ id: `f-${exercise_id}`, user_id: 'u', exercise_id, sets, target_reps, current_weight, increment: 2.5 })

test('pré-remplit les séries depuis les fiches, dans l’ordre du jour', () => {
  const fiches = new Map([['a', fiche('a', 3, 10, 40)], ['b', fiche('b', 4, 8, 60)]])
  const sets = buildWorkoutSets('w', [de('b', 1), de('a', 0)], fiches)
  expect(sets).toHaveLength(7)
  expect(sets.map((s) => s.position)).toEqual([0, 1, 2, 3, 4, 5, 6])
  expect(sets.slice(0, 3).every((s) => s.exercise_id === 'a' && s.reps === 10 && s.target_reps === 10 && s.weight === 40 && !s.done)).toBe(true)
  expect(sets.slice(3).every((s) => s.exercise_id === 'b' && s.reps === 8 && s.weight === 60)).toBe(true)
  expect(sets.every((s) => s.workout_id === 'w')).toBe(true)
  expect(new Set(sets.map((s) => s.id)).size).toBe(7)
})

test('exercice sans fiche → valeurs par défaut 3×10 à 0', () => {
  const sets = buildWorkoutSets('w', [de('x', 0)], new Map())
  expect(sets).toHaveLength(3)
  expect(sets.every((s) => s.reps === 10 && s.weight === 0)).toBe(true)
})
