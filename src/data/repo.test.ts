import { db } from './db'
import { repo, pull, setCurrentUser, type PullSource } from './repo'
import type { UserExercise } from '../domain/types'

const fiche = (w: number, updated_at?: string): UserExercise =>
  ({ id: 'f1', user_id: 'u', exercise_id: 'e', current_weight: w, sets: 3, target_reps: 10, increment: 2.5, updated_at })

beforeEach(async () => {
  setCurrentUser('u')
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

test('le code de partage n’est jamais renvoyé par le client', async () => {
  await repo.put('programs', { id: 'p', owner_id: 'u', name: 'A', is_active: true, share_code: 'K7QF2M9X' })
  const [entry] = await db.outbox.toArray()
  expect('share_code' in entry.row).toBe(false)
  expect((await db.programs.get('p'))?.share_code).toBe('K7QF2M9X')
})

test('pull ne supprime pas une ligne écrite pendant qu’il tourne', async () => {
  const src: PullSource = {
    fetch: async (table) => {
      if (table === 'workout_sets') {
        // Pendant le pull : une série est créée puis déjà envoyée (plus dans l'outbox).
        await db.workout_sets.put({ id: 's-new', workout_id: 'w', exercise_id: 'e', position: 0, target_reps: 8, reps: 8, weight: 60, done: false, updated_at: new Date().toISOString() })
      }
      return []
    },
  }
  await pull('u', src)
  expect(await db.workout_sets.get('s-new')).toBeDefined()
})

test('pull ne supprime pas une ligne refusée par le serveur (entrée « dead »)', async () => {
  await repo.put('user_exercises', fiche(80))
  await db.outbox.toCollection().modify({ dead: 1 })
  await pull('u', source({}))
  expect(await db.user_exercises.get('f1')).toBeDefined()
})

test('pull convertit l’arrondi (numeric renvoyé en texte) en nombre', async () => {
  await pull('u', source({ user_exercises: [{ ...fiche(70, '2026-02-01T00:00:00Z'), rounding: '2.50' }] }))
  expect((await db.user_exercises.get('f1'))?.rounding).toBe(2.5)
})

test('pull recopie les tables du calendrier', async () => {
  await pull('u', source({
    training_schedules: [{ id: 'u', user_id: 'u', weekdays: [1, 3], since: '2026-10-01', updated_at: '2026-10-01T00:00:00Z' }],
    schedule_overrides: [{ id: 'o', user_id: 'u', date: '2026-10-23', kind: 'train', moved_to: null, updated_at: '2026-10-01T00:00:00Z' }],
    weekly_goals: [{ id: 'g', user_id: 'u', week_start: '2026-10-19', sessions: 4, updated_at: '2026-10-01T00:00:00Z' }],
  }))
  expect(await db.training_schedules.get('u')).toMatchObject({ weekdays: [1, 3] })
  expect(await db.schedule_overrides.get('o')).toMatchObject({ kind: 'train' })
  expect(await db.weekly_goals.get('g')).toMatchObject({ sessions: 4 })
})

test('pull recopie la fiche et les pesées, nombres convertis', async () => {
  await pull('u', source({
    body_profiles: [{ id: 'u', user_id: 'u', height_cm: '180.0', protein_per_kg: '2.2', updated_at: '2026-10-01T00:00:00Z' }],
    weight_entries: [{ id: 'p', user_id: 'u', date: '2026-10-25', weight_kg: '75.40', updated_at: '2026-10-01T00:00:00Z' }],
  }))
  expect(await db.body_profiles.get('u')).toMatchObject({ height_cm: 180, protein_per_kg: 2.2 })
  expect(await db.weight_entries.get('p')).toMatchObject({ weight_kg: 75.4 })
})
