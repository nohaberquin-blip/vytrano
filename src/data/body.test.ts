import { db } from './db'
import { addWeight, getBodyProfile, latestWeight, listWeights, removeWeight, saveBodyProfile } from './body'

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

test('la fiche est créée puis complétée, les champs absents valent null', async () => {
  await saveBodyProfile('u', { sex: 'male', height_cm: 180 })
  expect(await getBodyProfile('u')).toEqual(expect.objectContaining({
    id: 'u', user_id: 'u', sex: 'male', height_cm: 180, goal: null, kcal_override: null, birth_date: null,
  }))
  await saveBodyProfile('u', { goal: 'cut' })
  expect(await getBodyProfile('u')).toMatchObject({ sex: 'male', height_cm: 180, goal: 'cut' })
  expect(await db.outbox.count()).toBe(1)
})

test('une pesée par jour : la deuxième remplace la première', async () => {
  await addWeight('u', '2026-10-25', 76)
  await addWeight('u', '2026-10-25', 75.4)
  expect(await listWeights('u')).toMatchObject([{ date: '2026-10-25', weight_kg: 75.4 }])
})

test('liste triée, dernière pesée, suppression, autres utilisateurs ignorés', async () => {
  await addWeight('u', '2026-10-25', 75)
  await addWeight('u', '2026-10-01', 77)
  await db.weight_entries.put({ id: 'x', user_id: 'autre', date: '2026-10-30', weight_kg: 90 })
  expect((await listWeights('u')).map((w) => w.date)).toEqual(['2026-10-01', '2026-10-25'])
  expect(await latestWeight('u')).toMatchObject({ date: '2026-10-25', weight_kg: 75 })
  await removeWeight((await latestWeight('u'))!.id)
  expect(await latestWeight('u')).toMatchObject({ date: '2026-10-01' })
})
