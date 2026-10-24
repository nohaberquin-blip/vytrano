import { db } from './db'
import { addSession, cancelMove, getSchedule, loadCalendarInput, moveSession, saveWeekdays, setRest, setWeeklyGoal } from './calendar'
import { addDay, createProgram } from './programs'

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

const overrides = async () => (await db.schedule_overrides.toArray()).sort((a, b) => a.date.localeCompare(b.date))

test('saveWeekdays crée le réglage avec since = aujourd’hui, puis le garde', async () => {
  await saveWeekdays('u', [1, 3], '2026-10-21')
  await saveWeekdays('u', [2], '2026-10-25')
  expect(await getSchedule('u')).toMatchObject({ id: 'u', user_id: 'u', weekdays: [2], since: '2026-10-21' })
  expect(await db.outbox.count()).toBe(1)
})

test('déplacer puis annuler', async () => {
  await moveSession('u', '2026-10-23', '2026-10-24')
  expect(await overrides()).toMatchObject([
    { date: '2026-10-23', kind: 'rest', moved_to: '2026-10-24', user_id: 'u' },
    { date: '2026-10-24', kind: 'train', moved_to: null },
  ])
  expect(await db.outbox.count()).toBe(2)
  await cancelMove('u', '2026-10-23')
  expect(await overrides()).toEqual([])
  expect((await db.outbox.toArray()).filter((e) => e.op === 'delete').length).toBe(2)
})

test('déplacer vers un jour qui avait une exception la remplace', async () => {
  await setRest('u', '2026-10-24')
  const before = (await overrides())[0]
  await moveSession('u', '2026-10-23', '2026-10-24')
  const after = await overrides()
  expect(after).toHaveLength(2)
  expect(after[1]).toMatchObject({ id: before.id, date: '2026-10-24', kind: 'train', moved_to: null })
})

test('passer en repos un jour ajouté supprime l’ajout ; ajouter un jour en repos forcé supprime le repos', async () => {
  await addSession('u', '2026-10-22')
  expect(await overrides()).toMatchObject([{ kind: 'train' }])
  await setRest('u', '2026-10-22')
  expect(await overrides()).toEqual([])
  await setRest('u', '2026-10-23')
  expect(await overrides()).toMatchObject([{ kind: 'rest', moved_to: null }])
  await addSession('u', '2026-10-23')
  expect(await overrides()).toEqual([])
})

test('les exceptions des autres utilisateurs ne sont pas touchées', async () => {
  await db.schedule_overrides.put({ id: 'x', user_id: 'autre', date: '2026-10-22', kind: 'train', moved_to: null })
  await setRest('u', '2026-10-22')
  expect(await db.schedule_overrides.get('x')).toBeDefined()
  expect((await overrides()).filter((o) => o.user_id === 'u')).toMatchObject([{ kind: 'rest' }])
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
  expect(input.today).toBe('2026-10-21')
  expect(input.workouts.map((w) => w.id)).toEqual(['w1'])
  expect(input.days.map((d) => d.name)).toEqual(['Jour A'])
  expect(input.schedule.weekdays).toEqual([1])
})

test('redéplacer une séance déjà reportée : l’origine suit, pas de faux report', async () => {
  await moveSession('u', '2026-10-23', '2026-10-24')
  await moveSession('u', '2026-10-24', '2026-10-25')
  expect(await overrides()).toMatchObject([
    { date: '2026-10-23', kind: 'rest', moved_to: '2026-10-25' },
    { date: '2026-10-25', kind: 'train', moved_to: null },
  ])
  await cancelMove('u', '2026-10-23')
  expect(await overrides()).toEqual([])
})

test('passer en repos une séance reportée : l’origine devient un simple repos', async () => {
  await moveSession('u', '2026-10-23', '2026-10-24')
  await setRest('u', '2026-10-24')
  expect(await overrides()).toMatchObject([{ date: '2026-10-23', kind: 'rest', moved_to: null }])
})

test('ramener une séance reportée à sa date d’origine efface le report', async () => {
  await moveSession('u', '2026-10-23', '2026-10-24')
  await moveSession('u', '2026-10-24', '2026-10-23')
  const rows = await overrides()
  expect(rows.every((o) => o.moved_to !== o.date)).toBe(true)
  expect(rows.filter((o) => o.kind === 'rest')).toEqual([])
})
