import type { SetKind } from './methods'
import { counts, exerciseRecords, oneRepMax, setRecords, type SessionSets } from './records'
import type { WorkoutSet } from './types'

let n = 0
const set = (weight: number, reps: number, extra: Partial<WorkoutSet> & { kind?: SetKind } = {}): WorkoutSet => ({
  id: `s${n++}`, workout_id: 'w', exercise_id: 'squat', position: n, target_reps: reps, reps, weight, done: true, ...extra,
})
const session = (date: string, sets: WorkoutSet[]): SessionSets => ({
  workout: { id: `w-${date}`, user_id: 'u', program_day_id: null, name: 'S', started_at: `${date}T12:00:00`, finished_at: `${date}T13:00:00`, status: 'done' },
  sets,
})

test('1RM estimé (Epley), arrondi à 0,5 kg', () => {
  expect(oneRepMax({ weight: 100, reps: 1 })).toBe(100)
  expect(oneRepMax({ weight: 100, reps: 8 })).toBe(126.5)
  expect(oneRepMax({ weight: 60, reps: 10 })).toBe(80)
})

test('séries prises en compte', () => {
  expect(counts(set(100, 5))).toBe(true)
  expect(counts(set(100, 5, { kind: 'top' }))).toBe(true)
  expect(counts(set(40, 10, { kind: 'warmup' }))).toBe(false)
  expect(counts(set(80, 8, { kind: 'drop' }))).toBe(false)
  expect(counts(set(100, 5, { done: false }))).toBe(false)
  expect(counts(set(0, 12))).toBe(false)
  expect(counts(set(100, 0))).toBe(false)
})

test('première séance : meilleures valeurs connues, aucun record', () => {
  const r = exerciseRecords([session('2026-09-01', [set(100, 5), set(105, 3)])])
  expect(r.weight).toEqual({ value: 105, date: '2026-09-01' })
  expect(r.e1rm).toEqual({ value: 116.5, date: '2026-09-01' })
  expect(r.points).toEqual([{ date: '2026-09-01', weight: 105, e1rm: 116.5, record: false }])
  expect(r.lastRecord).toBeNull()
  expect(setRecords([], [set(100, 5), set(110, 5)]).size).toBe(0)
})

test('séance suivante : record de charge seul ; égalité = pas de record', () => {
  const before = [session('2026-09-01', [set(100, 8)])] // 1RM 126,5
  const heavy = set(105, 2) // 1RM 112 : charge seulement
  const same = set(100, 8)
  const r = setRecords(before, [same, heavy])
  expect(r.get(heavy.id)).toEqual(['weight'])
  expect(r.has(same.id)).toBe(false)
})

test('même séance : la série 2 bat la série 1 qui battait déjà le record → les deux', () => {
  const before = [session('2026-09-01', [set(100, 5)])]
  const a = set(102.5, 5)
  const b = set(105, 5)
  const r = setRecords(before, [a, b])
  expect(r.get(a.id)).toEqual(['weight', 'e1rm'])
  expect(r.get(b.id)).toEqual(['weight', 'e1rm'])
})

test('points par séance et dernier record ; séries ignorées', () => {
  const r = exerciseRecords([
    session('2026-09-01', [set(100, 5)]),
    session('2026-09-08', [set(40, 10, { kind: 'warmup' }), set(100, 8)]),
    session('2026-09-15', [set(95, 5), set(200, 1, { done: false })]),
  ])
  expect(r.points.map((p) => [p.date, p.weight, p.e1rm, p.record])).toEqual([
    ['2026-09-01', 100, 116.5, false],
    ['2026-09-08', 100, 126.5, true],
    ['2026-09-15', 95, 111, false],
  ])
  expect(r.lastRecord).toBe('2026-09-08')
  expect(r.e1rm).toEqual({ value: 126.5, date: '2026-09-08' })
  expect(r.weight).toEqual({ value: 100, date: '2026-09-01' })
})
