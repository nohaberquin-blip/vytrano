import { createChallenge, listChallenges, loadMonthData, removeChallenge, setMonthGoal } from './challenges'
import { db } from './db'

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

test('créer un défi (début = aujourd’hui), le supprimer', async () => {
  await createChallenge('u', { kind: 'sessions', exercise_id: null, metric: null, target: 12, end_date: '2026-10-31' }, '2026-10-25')
  const [c] = await listChallenges('u')
  expect(c).toMatchObject({ kind: 'sessions', target: 12, start: '2026-10-25', end_date: '2026-10-31', user_id: 'u' })
  expect(await db.outbox.where('table').equals('challenges').count()).toBe(1)
  await removeChallenge(c.id)
  expect(await listChallenges('u')).toEqual([])
})

test('objectif du mois : modifié puis remis par défaut', async () => {
  await setMonthGoal('u', '2026-10', 9)
  await setMonthGoal('u', '2026-10', 10)
  const list = await listChallenges('u')
  expect(list).toHaveLength(1)
  expect(list[0]).toMatchObject({ kind: 'month', target: 10, start: '2026-10-01', end_date: '2026-10-31' })
  await setMonthGoal('u', '2026-10', null)
  expect(await listChallenges('u')).toEqual([])
})

test('données du mois : séances terminées, défis, historique sans séances allégées', async () => {
  await db.workouts.bulkPut([
    { id: 'a', user_id: 'u', program_day_id: null, name: 'S', started_at: '2026-10-05T12:00:00', finished_at: '2026-10-05T13:00:00', status: 'done' },
    { id: 'b', user_id: 'u', program_day_id: null, name: 'S', started_at: '2026-10-06T12:00:00', finished_at: null, status: 'in_progress' },
    { id: 'l', user_id: 'u', program_day_id: null, name: 'S', started_at: '2026-10-07T12:00:00', finished_at: '2026-10-07T13:00:00', status: 'done' },
  ])
  await db.workout_lightenings.put({ id: 'l', user_id: 'u', mode: 'minus10' })
  await db.workout_sets.bulkPut([
    { id: 'a1', workout_id: 'a', exercise_id: 'squat', position: 0, target_reps: 5, reps: 5, weight: 100, done: true },
    { id: 'l1', workout_id: 'l', exercise_id: 'squat', position: 0, target_reps: 5, reps: 5, weight: 200, done: true },
  ])
  const d = await loadMonthData('u', '2026-10-25')
  expect(d.workouts.map((w) => w.id).sort()).toEqual(['a', 'l'])
  expect(d.history.get('squat')!.map((h) => h.workout.id)).toEqual(['a'])
  expect(d.input).toBeNull()
})
