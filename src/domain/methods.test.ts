import {
  classicFrom, plannedWeight, presetTemplate, readTemplate, roundTo, setKind, templateError,
  withWarmup, withoutWarmup, hasWarmup, type PlannedSet,
} from './methods'

const rep = (n: number, s: PlannedSet) => Array.from({ length: n }, () => s)

test('top set + back-off', () => {
  expect(presetTemplate('top_backoff')).toEqual({
    method: 'top_backoff',
    sets: [{ kind: 'top', reps: 5, pct: 100 }, ...rep(3, { kind: 'backoff', reps: 8, pct: 85 })],
  })
})

test.each([
  ['classic', rep(4, { kind: 'work', reps: 8, pct: 100 })],
  ['ramp', [10, 8, 6, 4].map((reps, i) => ({ kind: 'work', reps, pct: [70, 80, 90, 100][i] }))],
  ['pyramid_down', [4, 6, 8, 10].map((reps, i) => ({ kind: 'work', reps, pct: [100, 90, 80, 70][i] }))],
  ['pyramid_full', [10, 6, 4, 6, 10].map((reps, i) => ({ kind: 'work', reps, pct: [70, 90, 100, 90, 70][i] }))],
  ['dropset', [...rep(3, { kind: 'work', reps: 8, pct: 100 }), { kind: 'drop', reps: null, pct: 80 }, { kind: 'drop', reps: null, pct: 60 }]],
  ['rest_pause', [{ kind: 'work', reps: null, pct: 100 }, ...rep(2, { kind: 'restpause', reps: null, pct: 100 })]],
  ['myo_reps', [{ kind: 'work', reps: 12, repsMax: 15, pct: 100 }, ...rep(4, { kind: 'restpause', reps: 3, repsMax: 5, pct: 100 })]],
  ['cluster', rep(12, { kind: 'cluster', reps: 3, pct: 100 })],
  ['amrap', [...rep(3, { kind: 'work', reps: 5, pct: 100 }), { kind: 'amrap', reps: 5, pct: 100 }]],
  ['double_progression', rep(3, { kind: 'work', reps: 8, repsMax: 12, pct: 100 })],
] as const)('méthode %s', (method, sets) => {
  expect(presetTemplate(method)).toEqual({ method, sets })
})

test('échauffement : ajouté en tête, sans doublon, et retirable', () => {
  const t = withWarmup(presetTemplate('classic'))
  expect(t.sets.slice(0, 2)).toEqual([{ kind: 'warmup', reps: 8, pct: 50 }, { kind: 'warmup', reps: 5, pct: 70 }])
  expect(t.method).toBe('classic')
  expect(hasWarmup(t)).toBe(true)
  expect(withWarmup(t).sets).toHaveLength(6)
  expect(withoutWarmup(t)).toEqual(presetTemplate('classic'))
})

test.each([
  [99.875, 2.5, 100], [31, 2, 32], [101.2, 0, 100], [101.2, undefined, 100], [0, 2.5, 0],
])('roundTo(%d, %s) = %d', (v, step, expected) => expect(roundTo(v, step)).toBe(expected))

test('plannedWeight', () => expect(plannedWeight(120, 85)).toBe(102.5))

test('lecture tolérante d’un modèle', () => {
  const fiche = { sets: 3, target_reps: 10 }
  const classic = { method: 'classic', sets: rep(3, { kind: 'work', reps: 10, pct: 100 }) }
  expect(classicFrom(fiche)).toEqual(classic)
  expect(readTemplate(null, fiche)).toEqual(classic)
  expect(readTemplate(undefined, fiche)).toEqual(classic)
  expect(readTemplate({ method: 'x', sets: 'n' }, fiche)).toEqual(classic)
  expect(readTemplate({ method: 'top_backoff', sets: [{ kind: 'nope', reps: 5, pct: 100 }] }, fiche)).toEqual(classic)
  expect(readTemplate({ method: 'top_backoff', sets: [] }, fiche)).toEqual(classic)
  expect(readTemplate(presetTemplate('amrap'), fiche)).toEqual(presetTemplate('amrap'))
})

test('validation d’un modèle', () => {
  const t = (sets: PlannedSet[]) => ({ method: 'custom' as const, sets })
  expect(templateError(t([{ kind: 'warmup', reps: 5, pct: 50 }]))).toBe('Au moins une série qui compte')
  expect(templateError(t([{ kind: 'work', reps: 5, pct: 0 }]))).toBe('Pourcentage entre 1 et 200')
  expect(templateError(t([{ kind: 'work', reps: 5, pct: 250 }]))).toBe('Pourcentage entre 1 et 200')
  expect(templateError(t([{ kind: 'work', reps: 0, pct: 100 }]))).toBe('Répétitions entre 1 et 100')
  expect(templateError(t([{ kind: 'work', reps: 150, pct: 100 }]))).toBe('Répétitions entre 1 et 100')
  expect(templateError(t([{ kind: 'work', reps: 10, repsMax: 8, pct: 100 }]))).toBe('Fourchette invalide')
  expect(templateError(presetTemplate('dropset'))).toBeNull()
})

test('setKind : une série ancienne sans type est une série de travail', () => {
  expect(setKind({ id: 's', workout_id: 'w', exercise_id: 'e', position: 0, target_reps: 8, reps: 8, weight: 60, done: true })).toBe('work')
  expect(setKind({ id: 's', workout_id: 'w', exercise_id: 'e', position: 0, target_reps: 8, reps: 8, weight: 60, done: true, kind: 'top' })).toBe('top')
})
