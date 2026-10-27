import type { Workout, WorkoutSet } from './types'
import { formatDuration, formatTonnage, globalStats } from './stats'

const w = (id: string, start: string, end: string | null): Workout => ({
  id, user_id: 'u', program_day_id: null, name: 'S', started_at: start, finished_at: end, status: 'done',
})
const s = (id: string, workout_id: string, weight: number, reps: number, extra: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id, workout_id, exercise_id: 'squat', position: 0, target_reps: reps, reps, weight, done: true, ...extra,
})

test('séances, minutes et charge totale (échauffement, non validée, 0 kg exclus ; dégressive comptée)', () => {
  const workouts = [w('a', '2026-10-01T10:00:00Z', '2026-10-01T11:00:00Z'), w('b', '2026-10-03T10:00:00Z', '2026-10-03T10:45:00Z')]
  const sets = [
    s('1', 'a', 100, 5), s('2', 'a', 60, 8, { kind: 'warmup' }), s('3', 'a', 100, 5, { done: false }),
    s('4', 'b', 0, 10), s('5', 'b', 80, 10, { kind: 'drop' }), s('6', 'b', 50, 0),
  ]
  expect(globalStats(workouts, sets)).toEqual({ sessions: 2, minutes: 105, tonnageKg: 1300 })
})

test('séance sans fin : comptée, 0 minute ; aucune séance', () => {
  expect(globalStats([w('a', '2026-10-01T10:00:00Z', null)], [])).toEqual({ sessions: 1, minutes: 0, tonnageKg: 0 })
  expect(globalStats([], [])).toEqual({ sessions: 0, minutes: 0, tonnageKg: 0 })
})

test('formats', () => {
  expect(formatDuration(0)).toBe('0 min')
  expect(formatDuration(59)).toBe('59 min')
  expect(formatDuration(3870)).toBe('64 h')
  expect(formatTonnage(0, 'kg')).toBe('0 kg')
  expect(formatTonnage(850, 'kg')).toBe('850 kg')
  expect(formatTonnage(182_500, 'kg')).toBe('182,5 t')
  expect(formatTonnage(12_383, 'lb')).toMatch(/^27.300 lb$/)
})
