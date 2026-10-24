import { db } from './db'
import { addSession, cancelMove, getSchedule, loadCalendarInput, moveSession, saveWeekdays, setRest, setWeeklyGoal } from './calendar'
import { addDay, createProgram } from './programs'

// Jours d'entraînement : lundi, mercredi, vendredi. 22 = jeudi, 23 = vendredi, 24 = samedi, 25 = dimanche, 26 = lundi.
beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  await saveWeekdays('u', [1, 3, 5], '2026-10-01')
})

const overrides = async () =>
  (await db.schedule_overrides.where('user_id').equals('u').toArray())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(({ date, kind, moved_to }) => ({ date, kind, moved_to }))

test('saveWeekdays crée le réglage avec since = aujourd’hui, puis le garde', async () => {
  await db.training_schedules.clear()
  await saveWeekdays('u', [3, 1], '2026-10-21')
  await saveWeekdays('u', [2], '2026-10-25')
  expect(await getSchedule('u')).toMatchObject({ id: 'u', user_id: 'u', weekdays: [2], since: '2026-10-21' })
})

test('déplacer puis annuler', async () => {
  await moveSession('u', '2026-10-23', '2026-10-24')
  expect(await overrides()).toEqual([
    { date: '2026-10-23', kind: 'rest', moved_to: '2026-10-24' },
    { date: '2026-10-24', kind: 'train', moved_to: null },
  ])
  await cancelMove('u', '2026-10-23')
  expect(await overrides()).toEqual([])
})

test('ids stables : appuis simultanés ou deux appareils visent la même ligne', async () => {
  await Promise.all([setWeeklyGoal('u', '2026-10-19', 4), setWeeklyGoal('u', '2026-10-19', 5)])
  expect(await db.weekly_goals.count()).toBe(1)
  await Promise.all([setRest('u', '2026-10-23'), setRest('u', '2026-10-23')])
  expect(await db.schedule_overrides.count()).toBe(1)
  await db.schedule_overrides.clear()
  await setRest('u', '2026-10-23')
  const id = (await db.schedule_overrides.toArray())[0].id
  await db.schedule_overrides.clear()
  await setRest('u', '2026-10-23')
  expect((await db.schedule_overrides.toArray())[0].id).toBe(id)
  expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
})

test('redéplacer une séance déjà reportée : l’origine suit', async () => {
  await moveSession('u', '2026-10-23', '2026-10-24')
  await moveSession('u', '2026-10-24', '2026-10-25')
  expect(await overrides()).toEqual([
    { date: '2026-10-23', kind: 'rest', moved_to: '2026-10-25' },
    { date: '2026-10-25', kind: 'train', moved_to: null },
  ])
  await cancelMove('u', '2026-10-23')
  expect(await overrides()).toEqual([])
})

test('ramener une séance à son jour d’origine (coché) efface tout, puis Passer en repos marche', async () => {
  await moveSession('u', '2026-10-23', '2026-10-24')
  await moveSession('u', '2026-10-24', '2026-10-23')
  expect(await overrides()).toEqual([])
  await setRest('u', '2026-10-23')
  expect(await overrides()).toEqual([{ date: '2026-10-23', kind: 'rest', moved_to: null }])
})

test('passer en repos une séance reportée : l’origine devient un simple repos', async () => {
  await moveSession('u', '2026-10-23', '2026-10-24')
  await setRest('u', '2026-10-24')
  expect(await overrides()).toEqual([{ date: '2026-10-23', kind: 'rest', moved_to: null }])
})

test('repos forcé puis ajout sur un jour coché ; ajout puis repos sur un jour non coché', async () => {
  await setRest('u', '2026-10-23')
  expect(await overrides()).toEqual([{ date: '2026-10-23', kind: 'rest', moved_to: null }])
  await addSession('u', '2026-10-23')
  expect(await overrides()).toEqual([])
  await addSession('u', '2026-10-22')
  expect(await overrides()).toEqual([{ date: '2026-10-22', kind: 'train', moved_to: null }])
  await setRest('u', '2026-10-22')
  expect(await overrides()).toEqual([])
})

test('déplacer vers un jour coché passé en repos : le repos forcé saute, pas d’exception train', async () => {
  await setRest('u', '2026-10-26')
  await moveSession('u', '2026-10-23', '2026-10-26')
  expect(await overrides()).toEqual([{ date: '2026-10-23', kind: 'rest', moved_to: '2026-10-26' }])
})

test('les exceptions des autres utilisateurs ne sont pas touchées', async () => {
  await db.schedule_overrides.put({ id: 'x', user_id: 'autre', date: '2026-10-22', kind: 'train', moved_to: null })
  await setRest('u', '2026-10-23')
  expect(await db.schedule_overrides.get('x')).toBeDefined()
})

test('objectif : création, modification, retour au défaut', async () => {
  await setWeeklyGoal('u', '2026-10-19', 4)
  const first = (await db.weekly_goals.toArray())[0]
  await setWeeklyGoal('u', '2026-10-19', 2)
  expect(await db.weekly_goals.toArray()).toMatchObject([{ id: first.id, sessions: 2, week_start: '2026-10-19', user_id: 'u' }])
  await setWeeklyGoal('u', '2026-10-19', null)
  expect(await db.weekly_goals.count()).toBe(0)
})

test('loadCalendarInput : null sans réglage ; séances terminées seulement ; programme actif', async () => {
  await db.training_schedules.clear()
  expect(await loadCalendarInput('u', '2026-10-21')).toBeNull()
  await saveWeekdays('u', [1], '2026-10-21')
  const p = await createProgram('u', 'P')
  await addDay(p.id, 'Jour A')
  await db.workouts.bulkPut([
    { id: 'w1', user_id: 'u', program_day_id: null, name: 'x', started_at: '2026-10-19T16:00:00Z', finished_at: '2026-10-19T17:00:00Z', status: 'done' },
    { id: 'w2', user_id: 'u', program_day_id: null, name: 'x', started_at: '2026-10-21T16:00:00Z', finished_at: null, status: 'in_progress' },
    { id: 'w3', user_id: 'autre', program_day_id: null, name: 'x', started_at: '2026-10-19T16:00:00Z', finished_at: '2026-10-19T17:00:00Z', status: 'done' },
  ])
  const input = (await loadCalendarInput('u', '2026-10-21'))!
  expect(input.workouts.map((w) => w.id)).toEqual(['w1'])
  expect(input.days.map((d) => d.name)).toEqual(['Jour A'])
  expect(input.schedule.weekdays).toEqual([1])
})

test('séance ajoutée (jour non coché) reportée puis passée en repos : plus aucune exception', async () => {
  await addSession('u', '2026-10-22')
  await moveSession('u', '2026-10-22', '2026-10-24')
  expect(await overrides()).toEqual([
    { date: '2026-10-22', kind: 'rest', moved_to: '2026-10-24' },
    { date: '2026-10-24', kind: 'train', moved_to: null },
  ])
  await setRest('u', '2026-10-24')
  expect(await overrides()).toEqual([])
})
