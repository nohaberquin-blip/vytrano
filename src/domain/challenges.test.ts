import { challengeProgress } from './challenges'
import type { SessionSets } from './records'
import type { Challenge, Workout, WorkoutSet } from './types'

const w = (id: string, date: string): Workout =>
  ({ id, user_id: 'u', program_day_id: null, name: 'S', started_at: `${date}T12:00:00`, finished_at: `${date}T13:00:00`, status: 'done' })
const s = (wid: string, weight: number, reps: number): WorkoutSet =>
  ({ id: `${wid}-s`, workout_id: wid, exercise_id: 'squat', position: 0, target_reps: reps, reps, weight, done: true })
const ch = (c: Partial<Challenge>): Challenge =>
  ({ id: 'c', user_id: 'u', kind: 'sessions', exercise_id: null, metric: null, target: 3, start: '2026-10-05', end_date: '2026-10-31', ...c })

test('défi séances : avant le début ignoré, réussi daté', () => {
  const ws = [w('a', '2026-10-04'), w('b', '2026-10-05'), w('c', '2026-10-08'), w('d', '2026-10-10'), w('e', '2026-10-12')]
  expect(challengeProgress(ch({}), ws, new Map(), '2026-10-20')).toEqual({ value: 4, target: 3, status: 'done', doneOn: '2026-10-10' })
  expect(challengeProgress(ch({}), ws.slice(0, 2), new Map(), '2026-10-20')).toMatchObject({ value: 1, status: 'active', doneOn: null })
  expect(challengeProgress(ch({}), ws.slice(0, 2), new Map(), '2026-11-01')).toMatchObject({ value: 1, status: 'failed' })
})

test('défi charge : charge max ou 1RM estimé sur la période', () => {
  const history = new Map<string, SessionSets[]>([['squat', [
    { workout: w('a', '2026-10-01'), sets: [s('a', 130, 1)] },
    { workout: w('b', '2026-10-06'), sets: [s('b', 110, 5)] },
    { workout: w('c', '2026-10-09'), sets: [s('c', 115, 3)] },
  ]]])
  const lift = (metric: 'weight' | 'e1rm', target: number) => challengeProgress(ch({ kind: 'lift', exercise_id: 'squat', metric, target }), [], history, '2026-10-20')
  expect(lift('weight', 120)).toEqual({ value: 115, target: 120, status: 'active', doneOn: null })
  expect(lift('e1rm', 128)).toEqual({ value: 128.5, target: 128, status: 'done', doneOn: '2026-10-06' })
})
