import { saveBodyProfile } from './body'
import { isFemale, listPeriods, removePeriod, setPeriodDays, startPeriod } from './cycle'
import { db } from './db'

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

test('noter, modifier et supprimer des règles', async () => {
  await startPeriod('u', '2026-10-20')
  await startPeriod('u', '2026-09-22', 4)
  const list = await listPeriods('u')
  expect(list.map((p) => [p.start, p.days])).toEqual([['2026-09-22', 4], ['2026-10-20', 5]])
  await setPeriodDays(list[1].id, 3)
  expect((await listPeriods('u'))[1].days).toBe(3)
  await removePeriod(list[0].id)
  expect((await listPeriods('u')).map((p) => p.start)).toEqual(['2026-10-20'])
  expect(await db.outbox.where('table').equals('periods').count()).toBeGreaterThan(0)
  expect(await listPeriods('autre')).toEqual([])
})

test('profil « Femme » seulement', async () => {
  expect(await isFemale('u')).toBe(false)
  await saveBodyProfile('u', { sex: 'male' })
  expect(await isFemale('u')).toBe(false)
  await saveBodyProfile('u', { sex: 'female' })
  expect(await isFemale('u')).toBe(true)
})
