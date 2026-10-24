import { db } from './db'
import { repo, pull, type PullSource } from './repo'
import type { UserExercise } from '../domain/types'

const fiche = (w: number, updated_at?: string): UserExercise =>
  ({ id: 'f1', user_id: 'u', exercise_id: 'e', current_weight: w, sets: 3, target_reps: 10, increment: 2.5, updated_at })

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

test('put écrit en local et ajoute un upsert dans l’outbox', async () => {
  await repo.put('user_exercises', fiche(60))
  expect((await db.user_exercises.get('f1'))?.current_weight).toBe(60)
  const out = await db.outbox.toArray()
  expect(out).toHaveLength(1)
  expect(out[0]).toMatchObject({ table: 'user_exercises', op: 'upsert', key: 'f1' })
  expect(out[0].row.updated_at).toBeTruthy()
})

test('deux put de la même ligne → une seule entrée, à la position d’origine, avec la dernière valeur', async () => {
  await repo.put('user_exercises', fiche(60))
  await repo.put('workouts', { id: 'w', user_id: 'u', program_day_id: null, name: 'J1', started_at: 'x', finished_at: null, status: 'in_progress' })
  await repo.put('user_exercises', fiche(62.5))
  const out = await db.outbox.orderBy('seq').toArray()
  expect(out.map((o) => o.key)).toEqual(['f1', 'w'])
  expect(out[0].row.current_weight).toBe(62.5)
})

test('remove supprime en local et ajoute un delete', async () => {
  await repo.put('user_exercises', fiche(60))
  await repo.remove('user_exercises', 'f1')
  expect(await db.user_exercises.get('f1')).toBeUndefined()
  const out = await db.outbox.orderBy('seq').toArray()
  expect(out.map((o) => o.op)).toEqual(['upsert', 'delete'])
})

const source = (rows: Partial<Record<string, unknown[]>>): PullSource => ({
  fetch: async (table) => (rows[table] ?? []) as never[],
})

test('pull remplace une ligne locale plus ancienne et ajoute les nouvelles', async () => {
  await db.user_exercises.put(fiche(50, '2026-01-01T00:00:00Z'))
  await pull('u', source({ user_exercises: [{ ...fiche(70, '2026-02-01T00:00:00Z'), current_weight: '70' }, { ...fiche(10), id: 'f2', exercise_id: 'e2', updated_at: '2026-02-01T00:00:00Z' }] }))
  expect((await db.user_exercises.get('f1'))?.current_weight).toBe(70)
  expect(await db.user_exercises.get('f2')).toBeDefined()
})

test('pull ne touche pas une ligne en attente de synchronisation', async () => {
  await repo.put('user_exercises', fiche(80))
  await pull('u', source({ user_exercises: [fiche(70, '2999-01-01T00:00:00Z')] }))
  expect((await db.user_exercises.get('f1'))?.current_weight).toBe(80)
})

test('pull supprime les lignes locales absentes du serveur (sauf en attente)', async () => {
  await db.user_exercises.put(fiche(50, '2026-01-01T00:00:00Z'))
  await repo.put('user_exercises', { ...fiche(1), id: 'f9', exercise_id: 'e9' })
  await pull('u', source({}))
  expect(await db.user_exercises.get('f1')).toBeUndefined()
  expect(await db.user_exercises.get('f9')).toBeDefined()
})
