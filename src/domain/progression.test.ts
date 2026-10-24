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

describe('selon le type de série', () => {
  const f = (extra: Partial<UserExercise> = {}): UserExercise => ({ ...fiche, current_weight: 100, ...extra })
  const set = (kind: WorkoutSet['kind'], reps: number, done: boolean, target: number | null, max?: number): WorkoutSet =>
    ({ id: Math.random().toString(), workout_id: 'w', exercise_id: 'e', position: 0, kind, target_reps: target, target_reps_max: max ?? null, reps, weight: 100, done })

  test('top + back-offs réussis, échauffement non validé → hausse', () => {
    expect(nextWeight(f(), [set('warmup', 0, false, 8), set('top', 5, true, 5), set('backoff', 8, true, 8), set('backoff', 8, true, 8), set('backoff', 8, true, 8)])).toBe(102.5)
  })
  test('drops non validés ne bloquent pas', () => {
    expect(nextWeight(f(), [set('work', 8, true, 8), set('drop', 0, false, null), set('drop', 0, false, null)])).toBe(102.5)
  })
  test('double progression : il faut le haut de la fourchette', () => {
    expect(nextWeight(f(), [12, 12, 11].map((r) => set('work', r, true, 8, 12)))).toBe(100)
    expect(nextWeight(f(), [12, 12, 12].map((r) => set('work', r, true, 8, 12)))).toBe(102.5)
  })
  test('AMRAP : au moins la cible', () => {
    expect(nextWeight(f(), [set('amrap', 7, true, 5)])).toBe(102.5)
    expect(nextWeight(f(), [set('amrap', 4, true, 5)])).toBe(100)
  })
  test('série qui compte « jusqu’à l’échec » validée avec 0 rep → réussie', () => {
    expect(nextWeight(f(), [set('work', 0, true, null)])).toBe(102.5)
  })
  test('aucune série qui compte → inchangé', () => {
    expect(nextWeight(f(), [set('warmup', 8, true, 8)])).toBe(100)
  })
  test('mode manuel → jamais de hausse automatique', () => {
    expect(nextWeight(f({ auto_progression: false }), [set('work', 8, true, 8)])).toBe(100)
  })
})
