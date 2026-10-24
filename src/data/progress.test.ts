import { db } from './db'
import { saveWeekdays } from './calendar'
import { cardOf, fetchFriendCards, loadProgress, setShareProgress } from './progress'

const calls: { table: string; op: string; arg?: unknown; eq?: [string, unknown] }[] = []
let failProfile = false
vi.mock('./supabase', () => ({
  supabase: {
    from: (table: string) => {
      const chain = (op: string, arg?: unknown) => {
        const entry: (typeof calls)[number] = { table, op, arg }
        calls.push(entry)
        const result = { error: table === 'profiles' && failProfile ? { message: 'hors ligne' } : null, data: [] as unknown[] }
        const p = Object.assign(Promise.resolve(result), {
          eq: (c: string, v: unknown) => { entry.eq = [c, v]; return Promise.resolve(result) },
          in: (c: string, v: unknown) => {
            entry.eq = [c, v]
            return Promise.resolve({ error: null, data: [{ user_id: 'f1', level: 4, title: 'Débutant', streak: 6, badges: ['sessions-1', 'sessions-10'] }] })
          },
        })
        return p
      }
      return {
        update: (v: unknown) => chain('update', v),
        upsert: (v: unknown) => chain('upsert', v),
        delete: () => chain('delete'),
        select: (v: unknown) => chain('select', v),
      }
    },
  },
}))

beforeEach(async () => {
  calls.length = 0
  failProfile = false
  await Promise.all(db.tables.map((t) => t.clear()))
})

const done = (id: string, date: string) => db.workouts.put({
  id, user_id: 'u', program_day_id: null, name: 'S', started_at: `${date}T10:00:00.000Z`, finished_at: `${date}T11:00:00.000Z`, status: 'done',
})

test('loadProgress lit les séances terminées et le calendrier', async () => {
  await done('a', '2026-10-19')
  await done('b', '2026-10-21')
  await done('c', '2026-10-23')
  await db.workouts.put({ id: 'x', user_id: 'u', program_day_id: null, name: 'S', started_at: '2026-10-24T10:00:00.000Z', finished_at: null, status: 'in_progress' })
  await saveWeekdays('u', [1, 3, 5], '2026-10-19')
  const p = await loadProgress('u', '2026-10-24')
  expect(p.xp).toBe(300 + 200)
  expect(p.streak).toBe(1)
  expect(cardOf(p)).toEqual({ level: 1, title: 'Débutant', streak: 1, badges: ['sessions-1', 'goal-1'] })
})

test('activer le partage : profil puis carte ; désactiver : carte supprimée d’abord', async () => {
  const p = await loadProgress('u', '2026-10-24')
  await setShareProgress('u', true, p)
  expect(calls.map((c) => `${c.table}:${c.op}`)).toEqual(['profiles:update', 'progress_cards:upsert'])
  expect(calls[1].arg).toMatchObject({ user_id: 'u', level: 1, title: 'Débutant', streak: 0, badges: [] })
  calls.length = 0
  await setShareProgress('u', false, p)
  expect(calls.map((c) => `${c.table}:${c.op}`)).toEqual(['progress_cards:delete', 'profiles:update'])
  expect(calls[0].eq).toEqual(['user_id', 'u'])
})

test('profil non enregistré (hors ligne) : rien n’est publié, erreur renvoyée', async () => {
  failProfile = true
  const r = await setShareProgress('u', true, await loadProgress('u', '2026-10-24'))
  expect(r.error).toBeTruthy()
  expect(calls.map((c) => c.table)).toEqual(['profiles'])
})

test('cartes des amis', async () => {
  const cards = await fetchFriendCards(['f1', 'f2'])
  expect(cards.get('f1')).toMatchObject({ level: 4, streak: 6, badges: ['sessions-1', 'sessions-10'] })
  expect(cards.has('f2')).toBe(false)
  expect(await fetchFriendCards([])).toEqual(new Map())
})
