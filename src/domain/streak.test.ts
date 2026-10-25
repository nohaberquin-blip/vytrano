import type { CalendarInput } from './calendar'
import { BADGES, progress, progressGain, titleFor, xpForLevel } from './streak'
import type { Workout } from './types'

let n = 0
const w = (date: string): Workout => {
  const [y, m, d] = date.split('-').map(Number)
  const at = new Date(y, m - 1, d, 12, n++ % 50).toISOString()
  return { id: `w${n}`, user_id: 'u', program_day_id: null, name: 'S', started_at: at, finished_at: at, status: 'done' }
}
/** 3 séances (lun, mer, ven) dans la semaine du lundi donné. */
const week = (monday: string) => {
  const d = Number(monday.slice(8))
  const day = (k: number) => {
    const x = new Date(Number(monday.slice(0, 4)), Number(monday.slice(5, 7)) - 1, d + k, 12)
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
  }
  return [w(day(0)), w(day(2)), w(day(4))]
}
const input = (today: string, goals: CalendarInput['goals'] = []): CalendarInput => ({
  today, schedule: { id: 'u', user_id: 'u', weekdays: [1, 3, 5], since: '2026-09-07' },
  overrides: [], goals, workouts: [], days: [], lastDoneDayId: null,
})
const MONDAYS = ['2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28', '2026-10-05', '2026-10-12',
  '2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23']

test('niveaux et titres', () => {
  expect(xpForLevel(1)).toBe(0)
  expect(xpForLevel(2)).toBe(1500)
  expect(xpForLevel(3)).toBe(3250)
  expect(progress([], null, '2026-10-25').level).toBe(1)
  expect(titleFor(1)).toBe('Débutant')
  expect(titleFor(4)).toBe('Débutant')
  expect(titleFor(5)).toBe('Régulier')
  expect(titleFor(30)).toBe('Légende')
  expect(titleFor(42)).toBe('Légende')
})

test('sans calendrier : XP des séances seulement, pas de série', () => {
  const p = progress([w('2026-09-01'), w('2026-09-03'), w('2026-09-05')], null, '2026-10-25')
  expect(p).toMatchObject({ xp: 300, streak: 0, jokers: 0, level: 1, xpInLevel: 300, xpForNext: 1500 })
  expect(p.badges).toEqual([{ id: 'sessions-1', date: '2026-09-01' }])
})

test('3 semaines réussies : série 3 et bonus 200, 220, 240 (la semaine en cours atteinte compte)', () => {
  const ws = MONDAYS.slice(0, 3).flatMap(week)
  const p = progress(ws, input('2026-09-26'), '2026-09-26')
  expect(p.streak).toBe(3)
  expect(p.xp).toBe(900 + 200 + 220 + 240)
  expect(p.level).toBe(2)
  expect(p.badges).toContainEqual({ id: 'goal-1', date: '2026-09-11' })
})

test('semaine ratée : sans joker la série repart à 0 ; avec joker elle tient', () => {
  const one = progress(week(MONDAYS[0]), input('2026-09-21'), '2026-09-21')
  expect(one.streak).toBe(0)
  const four = progress(MONDAYS.slice(0, 4).flatMap(week), input('2026-10-12'), '2026-10-12')
  expect(four.streak).toBe(4)
  expect(four.jokers).toBe(0)
  expect(four.badges).toContainEqual({ id: 'streak-4', date: '2026-10-02' })
})

test('jokers plafonnés à 2 ; bonus plafonné à 400', () => {
  const p = progress(MONDAYS.flatMap(week), input('2026-11-29'), '2026-11-29')
  expect(p.streak).toBe(12)
  expect(p.jokers).toBe(2)
  expect(p.xp).toBe(36 * 100 + 2900 + 400 + 400)
  expect(p.badges.map((b) => b.id)).toEqual(expect.arrayContaining(['goal-10', 'streak-12']))
})

test('objectif 0 neutre ; semaine en cours non atteinte neutre ; semaines avant le réglage ignorées', () => {
  const before = [w('2026-08-31'), w('2026-09-02')]
  const ws = [...before, ...week(MONDAYS[0]), ...week(MONDAYS[2]), w('2026-09-28')]
  const p = progress(ws, input('2026-09-29', [{ id: 'g', user_id: 'u', week_start: MONDAYS[1], sessions: 0 }]), '2026-09-29')
  expect(p.streak).toBe(2)
  expect(p.xp).toBe(9 * 100 + 200 + 220)
})

test('changer l’objectif d’une semaine passée recalcule tout', () => {
  const ws = week(MONDAYS[0]).slice(0, 2)
  expect(progress(ws, input('2026-09-14'), '2026-09-14').streak).toBe(0)
  expect(progress(ws, input('2026-09-14', [{ id: 'g', user_id: 'u', week_start: MONDAYS[0], sessions: 2 }]), '2026-09-14').streak).toBe(1)
})

test('deux séances le même jour : 200 XP, mais un seul jour pour la semaine', () => {
  const p = progress([w('2026-09-07'), w('2026-09-07'), w('2026-09-09')], input('2026-09-10'), '2026-09-10')
  expect(p.xp).toBe(200 + 100)
  expect(p.streak).toBe(0)
})

test('badges de séances, de niveau et « Le retour »', () => {
  const ten = Array.from({ length: 10 }, (_, i) => w(`2026-09-${String(i + 1).padStart(2, '0')}`))
  const p = progress(ten, null, '2026-10-25')
  expect(p.badges).toContainEqual({ id: 'sessions-10', date: '2026-09-10' })
  expect(progress([w('2026-09-01'), w('2026-09-22')], null, '2026-10-25').badges).toContainEqual({ id: 'comeback', date: '2026-09-22' })
  expect(progress([w('2026-09-01'), w('2026-09-21')], null, '2026-10-25').badges.map((b) => b.id)).not.toContain('comeback')
  const many = Array.from({ length: 80 }, (_, i) => w(`2026-0${i < 30 ? 6 : i < 60 ? 7 : 8}-${String((i % 30) + 1).padStart(2, '0')}`))
  expect(progress(many, null, '2026-10-25').badges.map((b) => b.id)).toEqual(expect.arrayContaining(['sessions-50', 'level-5']))
  expect(BADGES.map((b) => b.id)).toContain('comeback')
})

test('gain de fin de séance : XP, niveau atteint, nouveaux badges', () => {
  const before = progress([], null, '2026-10-25')
  const after = progress([w('2026-10-25')], null, '2026-10-25')
  const g = progressGain(before, after)
  expect(g.xp).toBe(100)
  expect(g.level).toBeNull()
  expect(g.badges.map((b) => b.label)).toEqual(['1re séance'])
  const big = progress(Array.from({ length: 14 }, (_, i) => w(`2026-09-${String(i + 1).padStart(2, '0')}`)), null, '2026-10-25')
  const more = progress(Array.from({ length: 15 }, (_, i) => w(`2026-09-${String(i + 1).padStart(2, '0')}`)), null, '2026-10-25')
  expect(big.level).toBe(1)
  expect(progressGain(big, more).level).toBe(2)
})

test('rapide sur 3 ans d’historique (moins de 15 ms)', () => {
  const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
  const ws: Workout[] = []
  for (let i = 0; i < 160; i++) for (const k of [0, 2, 4]) ws.push(w(iso(new Date(2023, 9, 2 + 7 * i + k, 12))))
  const big = { ...input('2026-10-25'), schedule: { id: 'u', user_id: 'u', weekdays: [1, 3, 5], since: '2023-10-02' } }
  progress(ws, big, '2026-10-25')
  const times = [0, 1, 2].map(() => { const t = performance.now(); progress(ws, big, '2026-10-25'); return performance.now() - t }).sort((a, b) => a - b)
  expect(times[1]).toBeLessThan(15)
})

test('paliers des badges : bronze, argent, or, platine', () => {
  const tier = (id: string) => BADGES.find((b) => b.id === id)!.tier
  expect([tier('sessions-1'), tier('sessions-10'), tier('sessions-50'), tier('sessions-100'), tier('sessions-250'), tier('sessions-500')])
    .toEqual(['bronze', 'bronze', 'silver', 'gold', 'gold', 'platinum'])
  expect(['streak-4', 'streak-12', 'streak-26', 'streak-52'].map(tier)).toEqual(['bronze', 'silver', 'gold', 'platinum'])
  expect(['level-5', 'level-10', 'level-20', 'level-30'].map(tier)).toEqual(['bronze', 'silver', 'gold', 'platinum'])
  expect([tier('goal-1'), tier('goal-10'), tier('comeback')]).toEqual(['bronze', 'silver', 'silver'])
  expect(new Set(BADGES.map((b) => b.icon))).toEqual(new Set(['dumbbell', 'flame', 'chevrons', 'target', 'comeback']))
})
