import type { CalendarInput } from './calendar'
import { monthEnd, monthGoal, monthReport, suggestedMonthGoal } from './month'
import type { SessionSets } from './records'
import type { Challenge, Workout, WorkoutSet } from './types'

const w = (id: string, date: string): Workout =>
  ({ id, user_id: 'u', program_day_id: null, name: 'S', started_at: `${date}T12:00:00`, finished_at: `${date}T13:00:00`, status: 'done' })
const input = (over: Partial<CalendarInput> = {}): CalendarInput => ({
  today: '2026-11-15', schedule: { id: 'u', user_id: 'u', weekdays: [1, 3, 5], since: '2026-09-01' },
  overrides: [], goals: [], workouts: [], days: [], lastDoneDayId: null, ...over,
})

test('fin de mois', () => {
  expect(monthEnd('2026-02')).toBe('2026-02-28')
  expect(monthEnd('2026-10')).toBe('2026-10-31')
})

test('objectif proposé : jours prévus du mois, avec reports et jours ajoutés', () => {
  // Octobre 2026 : 13 lundis, mercredis et vendredis.
  expect(suggestedMonthGoal(input(), '2026-10')).toBe(13)
  const moved = input({ overrides: [
    { id: 'o1', user_id: 'u', date: '2026-10-05', kind: 'rest', moved_to: '2026-10-06' },
    { id: 'o2', user_id: 'u', date: '2026-10-06', kind: 'train', moved_to: null },
    { id: 'o3', user_id: 'u', date: '2026-10-10', kind: 'train', moved_to: null },
  ] })
  expect(suggestedMonthGoal(moved, '2026-10')).toBe(14)
  expect(suggestedMonthGoal(input({ schedule: { id: 'u', user_id: 'u', weekdays: [1, 3, 5], since: '2026-10-15' } }), '2026-10')).toBe(7)
})

test('objectif modifié ; sans calendrier : pas d’objectif proposé', () => {
  const custom: Challenge = { id: 'm', user_id: 'u', kind: 'month', exercise_id: null, metric: null, target: 8, start: '2026-10-01', end_date: '2026-10-31' }
  expect(monthGoal(input(), '2026-10', [custom])).toEqual({ goal: 8, custom: true })
  expect(monthGoal(input(), '2026-10', [])).toEqual({ goal: 13, custom: false })
  expect(monthGoal(null, '2026-10', [])).toEqual({ goal: null, custom: false })
  expect(monthGoal(null, '2026-10', [custom])).toEqual({ goal: 8, custom: true })
})

test('bilan : séances, objectif, mois précédent, semaines, records, défis, XP, badges', () => {
  const sept = [w('s1', '2026-09-07'), w('s2', '2026-09-09')]
  // Octobre : semaine du 5 réussie (3 séances), puis 1 séance la semaine du 12.
  const oct = [w('o1', '2026-10-05'), w('o2', '2026-10-07'), w('o3', '2026-10-09'), w('o4', '2026-10-12')]
  const workouts = [...sept, ...oct]
  const set = (wid: string, weight: number): WorkoutSet => ({ id: `${wid}-1`, workout_id: wid, exercise_id: 'squat', position: 0, target_reps: 5, reps: 5, weight, done: true })
  const history = new Map<string, SessionSets[]>([['squat', [
    { workout: sept[0], sets: [set('s1', 100)] },
    { workout: oct[0], sets: [set('o1', 105)] },
  ]]])
  const challenges: Challenge[] = [
    { id: 'c1', user_id: 'u', kind: 'sessions', exercise_id: null, metric: null, target: 3, start: '2026-10-01', end_date: '2026-10-31' },
    { id: 'c2', user_id: 'u', kind: 'lift', exercise_id: 'squat', metric: 'weight', target: 140, start: '2026-10-01', end_date: '2026-10-20' },
  ]
  const r = monthReport('2026-10', { today: '2026-11-15', workouts, input: input(), challenges, history })
  expect(r).toMatchObject({ sessions: 4, goal: 13, previous: 2, weeks: 1 })
  expect(r.records).toEqual([{ exerciseId: 'squat' }])
  expect(r.challengesDone.map((c) => c.id)).toEqual(['c1'])
  expect(r.challengesFailed.map((c) => c.id)).toEqual(['c2'])
  expect(r.xp).toBe(400 + 200)
  expect(r.badges.map((b) => b.id)).toEqual(['goal-1', 'comeback']) // 26 jours sans séance avant le 5 octobre
})

test('bilan d’un mois sans séance', () => {
  const r = monthReport('2026-08', { today: '2026-11-15', workouts: [], input: null, challenges: [], history: new Map() })
  expect(r).toMatchObject({ sessions: 0, goal: null, previous: 0, weeks: 0, streak: 0, xp: 0, records: [], badges: [] })
})
