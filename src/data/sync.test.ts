import { db } from './db'
import { repo } from './repo'
import { createSync, type SyncClient } from './sync'

const w = (id: string) => ({ id, user_id: 'u', program_day_id: null, name: 'J', started_at: 'x', finished_at: null, status: 'in_progress' as const })

function fakeClient(fail: () => { message: string; code?: string } | null = () => null) {
  const calls: Array<[string, string, unknown[]]> = []
  const client: SyncClient = {
    upsert: async (table, rows) => { calls.push(['upsert', table, rows]); return { error: fail() } },
    delete: async (table, ids) => { calls.push(['delete', table, ids]); return { error: fail() } },
  }
  return { client, calls }
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

test('flush envoie dans l’ordre, en regroupant les entrées consécutives, puis vide l’outbox', async () => {
  await repo.put('workouts', w('w1'))
  await repo.put('workout_sets', { id: 's1', workout_id: 'w1', exercise_id: 'e', position: 0, target_reps: 8, reps: 8, weight: 60, done: false })
  await repo.put('workout_sets', { id: 's2', workout_id: 'w1', exercise_id: 'e', position: 1, target_reps: 8, reps: 8, weight: 60, done: false })
  await repo.remove('workouts', 'w0')
  const { client, calls } = fakeClient()
  await createSync(client).flush()
  expect(calls.map(([op, t, rows]) => [op, t, rows.length])).toEqual([
    ['upsert', 'workouts', 1],
    ['upsert', 'workout_sets', 2],
    ['delete', 'workouts', 1],
  ])
  expect(await db.outbox.count()).toBe(0)
})

test('erreur réseau → l’entrée reste avec attempts+1, puis part au flush suivant', async () => {
  await repo.put('workouts', w('w1'))
  let down = true
  const { client } = fakeClient(() => (down ? { message: 'Failed to fetch' } : null))
  const sync = createSync(client)
  await sync.flush()
  const [entry] = await db.outbox.toArray()
  expect(entry.attempts).toBe(1)
  down = false
  await sync.flush()
  expect(await db.outbox.count()).toBe(0)
})

test('erreur définitive (contrainte Postgres) → entrée mise de côté, la suite continue', async () => {
  await repo.put('workouts', w('bad'))
  await repo.put('user_exercises', { id: 'f', user_id: 'u', exercise_id: 'e', current_weight: 1, sets: 3, target_reps: 10, increment: 2.5 })
  let first = true
  const { client, calls } = fakeClient(() => (first ? ((first = false), { message: 'violates check', code: '23514' }) : null))
  await createSync(client).flush()
  expect(calls).toHaveLength(2)
  const left = await db.outbox.toArray()
  expect(left).toHaveLength(1)
  expect(left[0]).toMatchObject({ key: 'bad', dead: 1 })
})

test('un échec ne relance pas immédiatement l’envoi (le délai croissant s’applique)', async () => {
  await repo.put('workouts', w('w1'))
  const { client, calls } = fakeClient(() => ({ message: 'Failed to fetch' }))
  const stop = createSync(client).start()
  await new Promise((r) => setTimeout(r, 900))
  stop()
  expect(calls.length).toBe(1)
})
