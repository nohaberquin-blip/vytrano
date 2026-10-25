import { db } from './db'
import { allRecords, liveRecords } from './records'
import type { WorkoutSet } from '../domain/types'

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  await db.exercises.bulkPut([
    { id: 'squat', owner_id: null, name: 'Squat', muscle_group: 'Jambes' },
    { id: 'bench', owner_id: null, name: 'Développé couché', muscle_group: 'Pectoraux' },
  ])
})

let n = 0
async function workout(id: string, date: string, sets: [string, number, number][], status: 'done' | 'in_progress' = 'done') {
  await db.workouts.put({
    id, user_id: 'u', program_day_id: null, name: 'S', started_at: `${date}T12:00:00`, finished_at: status === 'done' ? `${date}T13:00:00` : null, status,
  })
  await db.workout_sets.bulkPut(sets.map(([ex, weight, reps], i): WorkoutSet => ({
    id: `${id}-${n++}`, workout_id: id, exercise_id: ex, position: i, target_reps: reps, reps, weight, done: true,
  })))
}

test('records de la séance en cours, comparés aux séances terminées ; séance allégée : aucun', async () => {
  await workout('a', '2026-09-01', [['squat', 100, 5]])
  await workout('cur', '2026-09-08', [['squat', 105, 5], ['squat', 100, 5], ['bench', 80, 5]], 'in_progress')
  const r = await liveRecords('u', 'cur')
  expect([...r.values()]).toEqual([['weight', 'e1rm']])
  await db.workout_lightenings.put({ id: 'cur', user_id: 'u', mode: 'minus10' })
  expect((await liveRecords('u', 'cur')).size).toBe(0)
})

test('mes records : par exercice, le plus récent record en haut ; séances allégées ignorées', async () => {
  await workout('a', '2026-09-01', [['squat', 100, 5], ['bench', 80, 5]])
  await workout('b', '2026-09-08', [['bench', 85, 5]])
  await workout('c', '2026-09-15', [['squat', 110, 5]])
  await workout('light', '2026-09-20', [['bench', 200, 5]])
  await db.workout_lightenings.put({ id: 'light', user_id: 'u', mode: 'minus10' })
  const list = await allRecords('u')
  expect(list.map((r) => [r.name, r.weight.value, r.lastRecord])).toEqual([
    ['Squat', 110, '2026-09-15'],
    ['Développé couché', 85, '2026-09-08'],
  ])
})
