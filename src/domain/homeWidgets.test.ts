import type { CalendarInput } from './calendar'
import { dailyGoals, nextSession, whenLabel } from './homeWidgets'
import type { MonthData } from './month'
import type { Challenge, ProgramDay, Workout } from './types'

const day = (id: string, position: number): ProgramDay => ({ id, program_id: 'p', position, name: id.toUpperCase() })
const days = [day('a', 0), day('b', 1), day('c', 2)]
const w = (id: string, date: string, program_day_id: string | null = null): Workout =>
  ({ id, user_id: 'u', program_day_id, name: 'S', started_at: `${date}T12:00:00`, finished_at: `${date}T13:00:00`, status: 'done' })
// Lundi 16 novembre 2026 ; jours cochés : lundi, mercredi, vendredi.
const today = '2026-11-16'
const input = (over: Partial<CalendarInput> = {}): CalendarInput => ({
  today, schedule: { id: 'u', user_id: 'u', weekdays: [1, 3, 5], since: '2026-09-01' },
  overrides: [], goals: [], workouts: [], days, lastDoneDayId: null, ...over,
})

test('prochaine séance : sans programme → rien ; sans calendrier → jour suivant de la rotation, sans date', () => {
  expect(nextSession(input({ days: [] }), [], null, today)).toBeNull()
  expect(nextSession(null, days, 'a', today)).toEqual({ date: null, day: days[1] })
})

test('prochaine séance : aujourd’hui prévu non fait → aujourd’hui ; fait → jour prévu suivant', () => {
  expect(nextSession(input({ lastDoneDayId: 'c' }), days, 'c', today)).toEqual({ date: today, day: days[0] })
  const done = input({ workouts: [w('w1', today, 'a')], lastDoneDayId: 'a' })
  expect(nextSession(done, days, 'a', today)).toEqual({ date: '2026-11-18', day: days[1] })
})

test('prochaine séance : aucun jour prévu sur 14 jours → sans date', () => {
  const empty = input({ schedule: { id: 'u', user_id: 'u', weekdays: [], since: '2026-09-01' } })
  expect(nextSession(empty, days, null, today)).toEqual({ date: null, day: days[0] })
})

test('libellé du jour', () => {
  expect(whenLabel(today, today)).toBe('Aujourd’hui')
  expect(whenLabel('2026-11-17', today)).toBe('Demain')
  expect(whenLabel('2026-11-19', today)).toBe('Jeudi')
  expect(whenLabel('2026-11-26', today)).toBe('26 novembre')
})

const data = (over: Partial<MonthData> = {}): MonthData => ({ today, workouts: [], input: input(), challenges: [], history: new Map(), ...over })
const ch = (id: string, end_date: string, target = 5, start = '2026-11-01'): Challenge =>
  ({ id, user_id: 'u', kind: 'sessions', exercise_id: null, metric: null, target, start, end_date })

test('objectifs du jour : séance du jour seulement un jour prévu', () => {
  expect(dailyGoals(data()).today).toEqual({ done: false })
  const workouts = [w('w1', today)]
  expect(dailyGoals(data({ workouts, input: input({ workouts }) })).today).toEqual({ done: true })
  expect(dailyGoals(data({ today: '2026-11-17', input: input({ today: '2026-11-17' }) })).today).toBeNull()
  expect(dailyGoals(data({ input: null })).today).toBeNull()
})

test('objectifs du jour : objectif du mois et défi actif le plus proche de la fin', () => {
  const workouts = [w('w1', '2026-11-02'), w('w2', '2026-11-04'), w('w0', '2026-10-30')]
  const g = dailyGoals(data({
    workouts,
    challenges: [ch('loin', '2026-12-31'), ch('proche', '2026-11-30'), ch('rate', '2026-11-10', 50), ch('fait', '2026-11-20', 1)],
  }))
  // Novembre 2026 : 13 lundis, mercredis et vendredis ; 2 séances en novembre.
  expect(g.month).toEqual({ done: 2, goal: 13 })
  expect(g.challenge?.c.id).toBe('proche')
  expect(g.challenge?.p).toMatchObject({ value: 2, target: 5, status: 'active' })
})

test('objectifs du jour : rien', () => {
  expect(dailyGoals(data({ input: null }))).toEqual({ today: null, month: null, challenge: null })
})
