import { addDays, buildCalendar, weekday, weekProgress, weekStart, type CalendarDay, type CalendarInput } from './calendar'
import type { ProgramDay, Workout } from './types'

const pd = (id: string, position: number): ProgramDay => ({ id, program_id: 'p', position, name: `Jour ${id}` })
const days = [pd('A', 0), pd('B', 1), pd('C', 2)]

/** Séance terminée commencée à 18 h locales ce jour-là. */
function w(date: string, dayId: string, n = 0): Workout {
  const [y, m, d] = date.split('-').map(Number)
  const start = new Date(y, m - 1, d, 18, n)
  return {
    id: `${date}-${n}`, user_id: 'u', program_day_id: dayId, name: dayId,
    started_at: start.toISOString(), finished_at: new Date(start.getTime() + 3600e3).toISOString(), status: 'done',
  }
}

const base: CalendarInput = {
  today: '2026-10-21', // mercredi
  schedule: { id: 'u', user_id: 'u', weekdays: [1, 3, 5], since: '2026-10-01' },
  overrides: [], goals: [], workouts: [], days, lastDoneDayId: null,
}
const at = (cal: CalendarDay[], date: string) => cal.find((c) => c.date === date)!
const state = (cal: CalendarDay[], date: string) => at(cal, date).state
const dayOf = (cal: CalendarDay[], date: string) => at(cal, date).day?.id ?? null
const ov = (date: string, kind: 'train' | 'rest', moved_to: string | null = null) =>
  ({ id: date, user_id: 'u', date, kind, moved_to })

test('dates : addDays franchit mois, année et changement d’heure', () => {
  expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  expect(addDays('2026-10-24', 2)).toBe('2026-10-26')
  expect(addDays('2026-03-28', 2)).toBe('2026-03-30')
  expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  expect(weekStart('2026-10-25')).toBe('2026-10-19')
  expect(weekStart('2026-10-19')).toBe('2026-10-19')
  expect(weekStart('2027-01-01')).toBe('2026-12-28')
  expect(weekday('2026-10-25')).toBe(7)
  expect(weekday('2026-10-19')).toBe(1)
})

test('passé : fait, manqué, repos ; rien de manqué avant since', () => {
  const cal = buildCalendar({ ...base, workouts: [w('2026-10-19', 'A')], lastDoneDayId: 'A' }, '2026-09-28', '2026-10-20')
  expect(state(cal, '2026-10-19')).toBe('done')
  expect(state(cal, '2026-10-16')).toBe('missed')
  expect(state(cal, '2026-09-28')).toBe('rest')
  expect(state(cal, '2026-10-20')).toBe('rest')
  expect(cal).toHaveLength(23)
})

test('une séance un jour non prévu est « fait »', () => {
  const cal = buildCalendar({ ...base, workouts: [w('2026-10-20', 'A')], lastDoneDayId: 'A' }, '2026-10-20', '2026-10-20')
  expect(state(cal, '2026-10-20')).toBe('done')
  expect(at(cal, '2026-10-20').workouts).toHaveLength(1)
})

test('futur : rotation à la suite du dernier jour fait, la séance ratée glisse', () => {
  const cal = buildCalendar({ ...base, workouts: [w('2026-10-19', 'A')], lastDoneDayId: 'A' }, '2026-10-21', '2026-10-26')
  expect(state(cal, '2026-10-21')).toBe('planned')
  expect(dayOf(cal, '2026-10-21')).toBe('B')
  expect(dayOf(cal, '2026-10-23')).toBe('C')
  expect(dayOf(cal, '2026-10-26')).toBe('A')
  expect(state(cal, '2026-10-22')).toBe('rest')
})

test('rotation calculée depuis aujourd’hui même si on affiche plus tard', () => {
  const cal = buildCalendar({ ...base, workouts: [w('2026-10-19', 'A')], lastDoneDayId: 'A' }, '2026-10-26', '2026-10-26')
  expect(cal).toHaveLength(1)
  expect(dayOf(cal, '2026-10-26')).toBe('A')
})

test('aujourd’hui déjà fait : la rotation reprend au jour prévu suivant', () => {
  const cal = buildCalendar({ ...base, workouts: [w('2026-10-21', 'B')], lastDoneDayId: 'B' }, '2026-10-21', '2026-10-23')
  expect(state(cal, '2026-10-21')).toBe('done')
  expect(dayOf(cal, '2026-10-23')).toBe('C')
})

test('report : origine « moved » avec movedTo, arrivée prévue avec la séance', () => {
  const input = { ...base, lastDoneDayId: 'B', overrides: [ov('2026-10-23', 'rest', '2026-10-24'), ov('2026-10-24', 'train')] }
  const cal = buildCalendar(input, '2026-10-21', '2026-10-26')
  expect(state(cal, '2026-10-23')).toBe('moved')
  expect(at(cal, '2026-10-23').movedTo).toBe('2026-10-24')
  expect(state(cal, '2026-10-24')).toBe('planned')
  expect(dayOf(cal, '2026-10-21')).toBe('C')
  expect(dayOf(cal, '2026-10-24')).toBe('A')
  expect(dayOf(cal, '2026-10-26')).toBe('B')
})

test('ajout et repos forcé', () => {
  const input = { ...base, lastDoneDayId: 'C', overrides: [ov('2026-10-22', 'train'), ov('2026-10-26', 'rest')] }
  const cal = buildCalendar(input, '2026-10-21', '2026-10-28')
  expect(dayOf(cal, '2026-10-21')).toBe('A')
  expect(state(cal, '2026-10-22')).toBe('planned')
  expect(dayOf(cal, '2026-10-22')).toBe('B')
  expect(dayOf(cal, '2026-10-23')).toBe('C')
  expect(state(cal, '2026-10-26')).toBe('rest')
  expect(dayOf(cal, '2026-10-28')).toBe('A')
})

test('passé manqué via un ajout, pas sur un repos forcé', () => {
  const input = { ...base, overrides: [ov('2026-10-14', 'train'), ov('2026-10-19', 'rest')] }
  const cal = buildCalendar(input, '2026-10-14', '2026-10-19')
  expect(state(cal, '2026-10-14')).toBe('missed')
  expect(state(cal, '2026-10-19')).toBe('rest')
})

test('plusieurs séances le même jour : un seul jour fait, compté une fois', () => {
  const input = { ...base, workouts: [w('2026-10-19', 'A', 0), w('2026-10-19', 'B', 1)], lastDoneDayId: 'B' }
  const cal = buildCalendar(input, '2026-10-19', '2026-10-19')
  expect(at(cal, '2026-10-19').workouts).toHaveLength(2)
  expect(weekProgress(input, '2026-10-19').done).toBe(1)
})

test('sans programme : jours prévus « Séance libre » (day null)', () => {
  const cal = buildCalendar({ ...base, days: [] }, '2026-10-21', '2026-10-23')
  expect(state(cal, '2026-10-21')).toBe('planned')
  expect(dayOf(cal, '2026-10-21')).toBeNull()
})

test('objectif : défaut = nombre de jours, surcharge, atteint', () => {
  const input = { ...base, workouts: [w('2026-10-19', 'A')], lastDoneDayId: 'A' }
  expect(weekProgress(input, '2026-10-19')).toEqual({ done: 1, goal: 3, reached: false })
  const goals = [{ id: 'g', user_id: 'u', week_start: '2026-10-19', sessions: 1 }]
  expect(weekProgress({ ...input, goals }, '2026-10-19')).toEqual({ done: 1, goal: 1, reached: true })
  expect(weekProgress({ ...input, goals }, '2026-10-26').goal).toBe(3)
  const none = { ...base, schedule: { ...base.schedule, weekdays: [] } }
  expect(weekProgress(none, '2026-10-19')).toEqual({ done: 0, goal: 0, reached: false })
})
