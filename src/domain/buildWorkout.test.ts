import { buildWorkoutSets } from './buildWorkout'
import { presetTemplate, withWarmup } from './methods'
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

describe('selon la méthode', () => {
  const de = (exercise_id: string, position: number, template?: ReturnType<typeof presetTemplate>): ProgramDayExercise =>
    ({ id: `de${position}`, day_id: 'd', exercise_id, position, template })
  const squat = (extra: Partial<UserExercise> = {}): UserExercise =>
    ({ id: 'f', user_id: 'u', exercise_id: 'sq', sets: 4, target_reps: 8, current_weight: 120, increment: 2.5, ...extra })

  test('top set + back-off : charges calculées et arrondies, types gardés', () => {
    const sets = buildWorkoutSets('w', [de('sq', 0)], new Map([['sq', squat({ template: presetTemplate('top_backoff') })]]))
    expect(sets.map((s) => [s.kind, s.target_reps, s.reps, s.weight, s.done])).toEqual([
      ['top', 5, 5, 120, false],
      ['backoff', 8, 8, 102.5, false], ['backoff', 8, 8, 102.5, false], ['backoff', 8, 8, 102.5, false],
    ])
  })

  test('méthode propre au jour, sur la même charge de référence', () => {
    const jour2 = { method: 'classic' as const, sets: Array.from({ length: 4 }, () => ({ kind: 'work' as const, reps: 10, pct: 80 })) }
    const sets = buildWorkoutSets('w', [de('sq', 0, jour2)], new Map([['sq', squat({ template: presetTemplate('top_backoff') })]]))
    expect(sets.map((s) => [s.reps, s.weight])).toEqual([[10, 95], [10, 95], [10, 95], [10, 95]]) // 96 arrondi au pas de 2,5
  })

  test('fiche ancienne sans méthode → classique depuis séries × reps', () => {
    const sets = buildWorkoutSets('w', [de('sq', 0)], new Map([['sq', squat({ current_weight: 61 })]]))
    expect(sets.map((s) => [s.kind, s.reps, s.weight])).toEqual(Array.from({ length: 4 }, () => ['work', 8, 61]))
  })

  test('échec, AMRAP et fourchette', () => {
    const t = { method: 'custom' as const, sets: [
      { kind: 'drop' as const, reps: null, pct: 80 },
      { kind: 'amrap' as const, reps: 5, pct: 100 },
      { kind: 'work' as const, reps: 8, repsMax: 12, pct: 100 },
    ] }
    const sets = buildWorkoutSets('w', [de('sq', 0)], new Map([['sq', squat({ current_weight: 100, template: t })]]))
    expect(sets.map((s) => [s.kind, s.target_reps, s.target_reps_max ?? null, s.reps])).toEqual([
      ['drop', null, null, 0], ['amrap', 5, null, 0], ['work', 8, 12, 8],
    ])
  })

  test('mode manuel : charges réelles de la dernière fois, rang par rang, le reste calculé', () => {
    const t = { method: 'classic' as const, sets: Array.from({ length: 3 }, () => ({ kind: 'work' as const, reps: 8, pct: 100 })) }
    const last = [70, 72.5].map((weight, i) => ({ id: `l${i}`, workout_id: 'old', exercise_id: 'sq', position: i, target_reps: 8, reps: 8, weight, done: true }))
    const sets = buildWorkoutSets('w', [de('sq', 0)], new Map([['sq', squat({ current_weight: 80, auto_progression: false, template: t })]]), new Map([['sq', last]]))
    expect(sets.map((s) => s.weight)).toEqual([70, 72.5, 80])
  })

  test('mode automatique : la dernière séance n’influence pas les charges', () => {
    const last = [{ id: 'l', workout_id: 'old', exercise_id: 'sq', position: 0, target_reps: 8, reps: 8, weight: 10, done: true }]
    const sets = buildWorkoutSets('w', [de('sq', 0)], new Map([['sq', squat()]]), new Map([['sq', last]]))
    expect(sets[0].weight).toBe(120)
  })
})

describe('mode manuel : alignement par type de série', () => {
  const squat = (template: ReturnType<typeof presetTemplate>): UserExercise =>
    ({ id: 'f', user_id: 'u', exercise_id: 'sq', sets: 4, target_reps: 8, current_weight: 100, increment: 2.5, auto_progression: false, template })
  const prev = (kinds: string[], weights: number[]) => kinds.map((kind, i) =>
    ({ id: `p${i}`, workout_id: 'old', exercise_id: 'sq', position: i, kind: kind as never, target_reps: 8, reps: 8, weight: weights[i], done: true }))

  test('cocher l’échauffement ne décale pas les charges de travail', () => {
    const last = prev(['work', 'work', 'work', 'work'], [90, 92.5, 95, 97.5])
    const sets = buildWorkoutSets('w', [{ id: 'de', day_id: 'd', exercise_id: 'sq', position: 0 }],
      new Map([['sq', squat(withWarmup(presetTemplate('classic')))]]), new Map([['sq', last]]))
    expect(sets.map((s) => [s.kind, s.weight])).toEqual([
      ['warmup', 50], ['warmup', 70], ['work', 90], ['work', 92.5], ['work', 95], ['work', 97.5],
    ])
  })
})
