import { db } from './db'
import { addDay, addDayExercise, createProgram, deleteProgram, getActiveProgram, moveDay, setActiveProgram, setDayExerciseTemplate } from './programs'
import { presetTemplate } from '../domain/methods'

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

test('le premier programme créé devient actif, pas les suivants', async () => {
  const a = await createProgram('u', 'PPL')
  const b = await createProgram('u', 'Full body')
  expect((await db.programs.get(a.id))?.is_active).toBe(true)
  expect((await db.programs.get(b.id))?.is_active).toBe(false)
})

test('setActiveProgram : un seul programme actif', async () => {
  const a = await createProgram('u', 'A')
  const b = await createProgram('u', 'B')
  await setActiveProgram('u', b.id)
  expect((await db.programs.get(a.id))?.is_active).toBe(false)
  expect((await db.programs.get(b.id))?.is_active).toBe(true)
})

test('addDayExercise crée la fiche si absente et réutilise l’existante', async () => {
  const p = await createProgram('u', 'A')
  const d1 = await addDay(p.id, 'Jour 1')
  const d2 = await addDay(p.id, 'Jour 2')
  await addDayExercise('u', d1.id, 'squat')
  await addDayExercise('u', d2.id, 'squat')
  expect(await db.user_exercises.where('exercise_id').equals('squat').count()).toBe(1)
  expect(await db.program_day_exercises.count()).toBe(2)
})

test('addDay ajoute à la fin ; moveDay(+1) sur le dernier jour ne change rien', async () => {
  const p = await createProgram('u', 'A')
  const d1 = await addDay(p.id, 'Jour 1')
  const d2 = await addDay(p.id, 'Jour 2')
  expect(d2.position).toBeGreaterThan(d1.position)
  await moveDay(d2.id, 1)
  expect((await db.program_days.get(d2.id))?.position).toBe(d2.position)
  await moveDay(d2.id, -1)
  expect((await db.program_days.get(d2.id))!.position).toBeLessThan((await db.program_days.get(d1.id))!.position)
})

test('getActiveProgram renvoie jours triés et exercices par jour', async () => {
  const p = await createProgram('u', 'A')
  const d1 = await addDay(p.id, 'Jour 1')
  await addDayExercise('u', d1.id, 'squat')
  await addDayExercise('u', d1.id, 'bench')
  const active = await getActiveProgram('u')
  expect(active?.program.id).toBe(p.id)
  expect(active?.days.map((d) => d.name)).toEqual(['Jour 1'])
  expect(active?.exercisesByDay.get(d1.id)?.map((e) => e.exercise_id)).toEqual(['squat', 'bench'])
})

test('supprimer le programme actif en active un autre', async () => {
  const a = await createProgram('u', 'A')
  const b = await createProgram('u', 'B')
  await addDay(a.id, 'Jour 1')
  await deleteProgram('u', a.id)
  expect(await db.programs.get(a.id)).toBeUndefined()
  expect(await db.program_days.count()).toBe(0)
  expect((await db.programs.get(b.id))?.is_active).toBe(true)
})

test('méthode propre à un exercice d’un jour : définie puis retirée, chaque fois envoyée au serveur', async () => {
  const p = await createProgram('u', 'A')
  const d = await addDay(p.id, 'Jour 1')
  const item = await addDayExercise('u', d.id, 'squat')
  await db.outbox.clear()
  await setDayExerciseTemplate(item.id, presetTemplate('classic'))
  expect((await db.program_day_exercises.get(item.id))?.template).toEqual(presetTemplate('classic'))
  await setDayExerciseTemplate(item.id, null)
  expect((await db.program_day_exercises.get(item.id))?.template).toBeNull()
  const out = await db.outbox.toArray()
  expect(out).toHaveLength(1) // même ligne : l'écriture en attente est mise à jour
  expect(out[0].row.template).toBeNull()
})
