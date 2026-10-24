import { estimateSeconds, fitToSeconds, fitToTime, type FitExercise } from './fitTime'
import type { SetKind } from './methods'
import type { WorkoutSet } from './types'

let n = 0
const s = (exerciseId: string, kind: SetKind = 'work', reps: number | null = 10): WorkoutSet => ({
  id: `${exerciseId}-${kind}-${n++}`, workout_id: 'w', exercise_id: exerciseId, position: 0,
  target_reps: reps, reps: reps ?? 0, weight: 50, done: false, kind,
})
const ex = (key: string, kinds: SetKind[], priority = false): FitExercise =>
  ({ key, exerciseId: key, priority, sets: kinds.map((k) => s(key, k)) })
const ids = (e: FitExercise[]) => e.map((x) => `${x.key}:${x.sets.map((y) => y.kind).join(',')}`)
const none = new Map()

const W: SetKind[] = ['warmup', 'warmup', 'work', 'work', 'work', 'work']
const session = () => [ex('A', W), ex('B', W), ex('C', ['work', 'work', 'work', 'work']), ex('D', ['work', 'work', 'work'])]

test('estimation : installation, séries et repos (pas après la dernière)', () => {
  const one = [ex('A', ['work', 'work'])]
  expect(estimateSeconds(one, new Map([['A', { rest_seconds: null, target_reps: 8, current_weight: 0 }]]))).toBe(60 + 40 + 120 + 40)
  expect(estimateSeconds([], none)).toBe(0)
})

test('la séance tient : rien ne change', () => {
  const r = fitToTime(session(), none, 90)
  expect(r.changed).toBe(false)
  expect(r.seconds).toBe(r.fullSeconds)
})

test('étape 1 : un seul échauffement (le dernier) sauf sur le premier exercice', () => {
  const full = session()
  const step1 = [full[0], { ...full[1], sets: full[1].sets.slice(1) }, full[2], full[3]]
  const r = fitToSeconds(full, none, estimateSeconds(step1, none))
  expect(ids(r.exercises)).toEqual(ids(step1))
  expect(r.exercises[1].sets[0].id).toBe(full[1].sets[1].id)
  expect(r.changes).toContainEqual({ key: 'B', from: 6, to: 5 })
  expect(full[1].sets).toHaveLength(6) // entrée non modifiée
})

test('étape 2 : non prioritaires à 2 séries, de la fin vers le début, arrêt dès que ça tient', () => {
  const target = [ex('A', W), ex('B', ['warmup', 'work', 'work', 'work', 'work']), ex('C', ['work', 'work', 'work', 'work']), ex('D', ['work', 'work'])]
  const r = fitToSeconds(session(), none, estimateSeconds(target, none))
  expect(ids(r.exercises)).toEqual(ids(target))
})

test('étape 3 : retrait de la fin ; un prioritaire n’est jamais retiré', () => {
  const sess = [ex('A', W), ex('B', W), ex('C', ['work', 'work', 'work', 'work'], true), ex('D', ['work', 'work', 'work'])]
  const target = [ex('A', ['warmup', 'warmup', 'work', 'work']), ex('C', ['work', 'work', 'work', 'work'])]
  const r = fitToSeconds(sess, none, estimateSeconds(target, none))
  expect(ids(r.exercises)).toEqual(ids(target))
  expect(r.changes).toContainEqual({ key: 'D', from: 3, to: 0 })
  expect(r.changes).toContainEqual({ key: 'B', from: 6, to: 0 })
})

test('au moins un exercice : sans prioritaire, le premier reste ; étape 4 : prioritaires à 2 séries', () => {
  const r = fitToSeconds(session(), none, 1)
  expect(ids(r.exercises)).toEqual(['A:warmup,warmup,work,work'])
  expect(r.minimum).toBe(true)
  const withPrio = [ex('A', W), ex('B', ['work', 'work', 'work', 'work'], true)]
  const r2 = fitToSeconds(withPrio, none, 1)
  expect(ids(r2.exercises)).toEqual(['B:work,work'])
})

test('méthodes : top-set gardé, back-offs retirés ; un drop part avec sa série', () => {
  const sess = [ex('A', ['top', 'backoff', 'backoff', 'backoff']), ex('B', ['work', 'work', 'drop', 'work', 'drop'])]
  const r = fitToSeconds(sess, none, 1)
  expect(ids(r.exercises)).toEqual(['A:top,backoff'])
  const r2 = fitToSeconds(sess, none, estimateSeconds([sess[0], ex('B', ['work', 'work', 'drop'])], none))
  expect(ids(r2.exercises)).toEqual(['A:top,backoff,backoff,backoff', 'B:work,work,drop'])
})

test('positions renumérotées, séries identiques', () => {
  const r = fitToSeconds(session(), none, 1)
  expect(r.exercises.flatMap((e) => e.sets.map((x) => x.position))).toEqual([0, 1, 2, 3])
  expect(r.exercises[0].sets[2]).toMatchObject({ weight: 50, target_reps: 10, kind: 'work' })
})
