import type { FitExercise } from './fitTime'
import { lighten, lightenChanges } from './lighten'
import type { SetKind } from './methods'
import type { WorkoutSet } from './types'

let n = 0
const s = (exerciseId: string, kind: SetKind, weight = 60): WorkoutSet => ({
  id: `${exerciseId}-${n++}`, workout_id: 'w', exercise_id: exerciseId, position: n,
  target_reps: 8, reps: 8, weight, done: false, kind,
})
const ex = (key: string, kinds: SetKind[], weight = 60): FitExercise =>
  ({ key, exerciseId: key, priority: false, sets: kinds.map((k) => s(key, k, k === 'warmup' ? 30 : weight)) })
const kinds = (e: FitExercise) => e.sets.map((x) => x.kind).join(',')
const fiches = new Map([['A', { rounding: 2.5 }], ['B', { rounding: 1 }]])

test('−10 % et −20 % arrondis au pas de l’exercice ; 0 reste 0', () => {
  const day = [ex('A', ['warmup', 'work', 'work']), ex('B', ['work'], 0)]
  const m10 = lighten(day, 'minus10', fiches)
  expect(m10[0].sets.map((x) => x.weight)).toEqual([27.5, 55, 55])
  expect(lighten(day, 'minus20', fiches)[0].sets.map((x) => x.weight)).toEqual([25, 47.5, 47.5])
  expect(m10[1].sets[0].weight).toBe(0)
  expect(m10[0].sets.map((x) => [x.kind, x.reps, x.target_reps])).toEqual(day[0].sets.map((x) => [x.kind, x.reps, x.target_reps]))
  expect(day[0].sets[1].weight).toBe(60) // entrée non modifiée
})

test('moins de séries : 2 unités, échauffements gardés, rattachées avec leur série, top-set gardé', () => {
  const day = [
    ex('A', ['warmup', 'work', 'work', 'work', 'work']),
    ex('B', ['work', 'work', 'work', 'drop']),
    ex('C', ['top', 'backoff', 'backoff', 'backoff']),
  ]
  const r = lighten(day, 'fewer', fiches)
  expect(r.map(kinds)).toEqual(['warmup,work,work', 'work,work', 'top,backoff'])
  expect(r[0].sets[1].weight).toBe(60)
})

test('changements : charge de la 1re série de travail et nombre de séries, exercices modifiés seulement', () => {
  const day = [ex('A', ['warmup', 'work', 'work', 'work', 'work']), ex('B', ['work', 'work'])]
  expect(lightenChanges(day, lighten(day, 'minus10', fiches))).toEqual([
    { key: 'A', fromKg: 60, toKg: 55, from: 5, to: 5 },
    { key: 'B', fromKg: 60, toKg: 54, from: 2, to: 2 },
  ])
  expect(lightenChanges(day, lighten(day, 'fewer', fiches))).toEqual([{ key: 'A', fromKg: 60, toKg: 60, from: 5, to: 3 }])
})
